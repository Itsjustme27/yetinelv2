#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Mini SIEM Windows Agent - Security Event Collector

.DESCRIPTION
    Collects Windows Security Event Log entries and sends them to the Mini SIEM backend.
    Must be run as Administrator to access Security logs.

.PARAMETER ServerHost
    The hostname or IP of the SIEM server (default: localhost)

.PARAMETER ServerPort
    The port of the SIEM server (default: 3001)

.PARAMETER BatchSize
    Number of events to send per batch (default: 50)

.PARAMETER PollIntervalSeconds
    How often to check for new events (default: 5)

.EXAMPLE
    .\agent.ps1 -ServerHost "192.168.1.100" -ServerPort 3001
#>

param(
    [string]$ServerHost = "localhost",
    [int]$ServerPort = 3001,
    [int]$BatchSize = 50,
    [int]$PollIntervalSeconds = 5,
    [int]$HeartbeatIntervalSeconds = 30
)

# Configuration
$Script:Config = @{
    ServerUrl = "http://${ServerHost}:${ServerPort}"
    BatchSize = $BatchSize
    PollInterval = $PollIntervalSeconds
    HeartbeatInterval = $HeartbeatIntervalSeconds
    # Security Event IDs to collect
    EventIds = @(
        4624, 4625,  # Logon success/failure
        4634, 4647,  # Logoff
        4648,        # Explicit credential logon
        4672,        # Special privileges
        4688, 4689,  # Process creation/exit
        4697, 7045,  # Service installation
        4720, 4722, 4723, 4724, 4725, 4726, 4738, 4740,  # Account management
        4698, 4699, 4702,  # Scheduled tasks
        1102,        # Audit log cleared
        4616,        # System time changed
        4719         # Audit policy changed
    )
}

# Agent state
$Script:AgentId = $null
$Script:LastEventTime = [DateTime]::Now.AddMinutes(-5)  # Start 5 minutes back
$Script:EventQueue = [System.Collections.ArrayList]::new()
$Script:IsRunning = $false

function Write-Log {
    param([string]$Level, [string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

function Get-AgentId {
    $hostname = $env:COMPUTERNAME
    $mac = (Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1).MacAddress
    if (-not $mac) { $mac = "unknown" }
    $mac = $mac -replace '[:-]', ''
    return "windows-$hostname-$mac".ToLower()
}

function Get-LocalIP {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' -or $_.PrefixOrigin -eq 'Manual' } | Select-Object -First 1).IPAddress
    if (-not $ip) { $ip = "127.0.0.1" }
    return $ip
}

function Invoke-SiemRequest {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Body = $null
    )

    $uri = "$($Script:Config.ServerUrl)$Path"
    $headers = @{
        "Content-Type" = "application/json"
        "User-Agent" = "MiniSIEM-WindowsAgent/1.0"
    }

    try {
        $params = @{
            Uri = $uri
            Method = $Method
            Headers = $headers
            TimeoutSec = 10
        }

        if ($Body) {
            $params.Body = $Body | ConvertTo-Json -Depth 10 -Compress
        }

        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        Write-Log "ERROR" "Request failed: $_"
        return $null
    }
}

function Register-Agent {
    Write-Log "INFO" "Registering agent with server..."

    $body = @{
        id = $Script:AgentId
        hostname = $env:COMPUTERNAME
        ip_address = Get-LocalIP
        os = "Windows"
        os_version = [System.Environment]::OSVersion.VersionString
        agent_version = "1.0.0"
        config = @{
            event_ids = $Script:Config.EventIds
        }
    }

    $response = Invoke-SiemRequest -Method "POST" -Path "/api/endpoints/register" -Body $body

    if ($response) {
        Write-Log "INFO" "Agent registered: $($response.hostname) ($($response.id))"
        return $true
    }

    return $false
}

function Send-Heartbeat {
    $body = @{
        endpoint_id = $Script:AgentId
        stats = @{
            queue_size = $Script:EventQueue.Count
            uptime = (Get-Date) - (Get-Process -Id $PID).StartTime
        }
    }

    $response = Invoke-SiemRequest -Method "POST" -Path "/api/ingest/heartbeat" -Body $body

    if (-not $response) {
        Write-Log "WARN" "Heartbeat failed"
    }
}

function Convert-EventToJson {
    param([System.Diagnostics.Eventing.Reader.EventLogRecord]$Event)

    # Extract properties
    $properties = @()
    if ($Event.Properties) {
        foreach ($prop in $Event.Properties) {
            $properties += @{
                Value = $prop.Value
            }
        }
    }

    return @{
        Id = $Event.Id
        TimeCreated = $Event.TimeCreated.ToString("o")
        MachineName = $Event.MachineName
        ProviderName = $Event.ProviderName
        LogName = $Event.LogName
        Level = $Event.Level
        Keywords = $Event.Keywords
        Task = $Event.Task
        Opcode = $Event.Opcode
        Properties = $properties
        Message = $Event.Message
    }
}

function Get-SecurityEvents {
    try {
        $filterXml = @"
<QueryList>
    <Query Id="0" Path="Security">
        <Select Path="Security">
            *[System[(EventID=$($Script:Config.EventIds -join ' or EventID=')) and TimeCreated[@SystemTime >= '$($Script:LastEventTime.ToUniversalTime().ToString("o"))']]]
        </Select>
    </Query>
</QueryList>
"@

        $events = Get-WinEvent -FilterXml $filterXml -ErrorAction SilentlyContinue

        if ($events) {
            Write-Log "DEBUG" "Found $($events.Count) new events"

            foreach ($event in $events) {
                $eventJson = Convert-EventToJson -Event $event
                [void]$Script:EventQueue.Add($eventJson)

                # Update last event time
                if ($event.TimeCreated -gt $Script:LastEventTime) {
                    $Script:LastEventTime = $event.TimeCreated.AddSeconds(1)
                }
            }
        }
    }
    catch {
        if ($_.Exception.Message -notmatch "No events were found") {
            Write-Log "ERROR" "Failed to get events: $_"
        }
    }
}

function Send-EventBatch {
    if ($Script:EventQueue.Count -eq 0) {
        return
    }

    $batchSize = [Math]::Min($Script:Config.BatchSize, $Script:EventQueue.Count)
    $batch = $Script:EventQueue.GetRange(0, $batchSize)
    $Script:EventQueue.RemoveRange(0, $batchSize)

    $body = @{
        endpoint_id = $Script:AgentId
        source = "windows"
        events = $batch
    }

    $response = Invoke-SiemRequest -Method "POST" -Path "/api/ingest/batch" -Body $body

    if ($response) {
        Write-Log "INFO" "Sent $batchSize events, alerts: $($response.alerts)"
    }
    else {
        # Put events back in queue
        $Script:EventQueue.InsertRange(0, $batch)
        Write-Log "WARN" "Failed to send batch, events re-queued"
    }
}

function Start-Agent {
    Write-Log "INFO" "========================================"
    Write-Log "INFO" "Mini SIEM Windows Agent Starting"
    Write-Log "INFO" "Host: $env:COMPUTERNAME ($(Get-LocalIP))"
    Write-Log "INFO" "Agent ID: $Script:AgentId"
    Write-Log "INFO" "Server: $($Script:Config.ServerUrl)"
    Write-Log "INFO" "Monitoring Event IDs: $($Script:Config.EventIds -join ', ')"
    Write-Log "INFO" "========================================"

    # Register with server
    $maxRetries = 3
    $registered = $false

    for ($i = 0; $i -lt $maxRetries; $i++) {
        if (Register-Agent) {
            $registered = $true
            break
        }
        Write-Log "INFO" "Retrying registration in 5 seconds..."
        Start-Sleep -Seconds 5
    }

    if (-not $registered) {
        Write-Log "ERROR" "Failed to register after $maxRetries attempts. Exiting."
        exit 1
    }

    $Script:IsRunning = $true
    $lastHeartbeat = Get-Date

    Write-Log "INFO" "Agent started. Monitoring Security Event Log..."

    while ($Script:IsRunning) {
        # Collect events
        Get-SecurityEvents

        # Send batch if we have events
        if ($Script:EventQueue.Count -gt 0) {
            Send-EventBatch
        }

        # Heartbeat
        $now = Get-Date
        if (($now - $lastHeartbeat).TotalSeconds -ge $Script:Config.HeartbeatInterval) {
            Send-Heartbeat
            $lastHeartbeat = $now
        }

        # Wait for next poll
        Start-Sleep -Seconds $Script:Config.PollInterval
    }
}

function Stop-Agent {
    Write-Log "INFO" "Stopping agent..."
    $Script:IsRunning = $false

    # Flush remaining events
    while ($Script:EventQueue.Count -gt 0) {
        Write-Log "INFO" "Flushing $($Script:EventQueue.Count) remaining events..."
        Send-EventBatch
    }

    Write-Log "INFO" "Agent stopped"
}

# Main
$Script:AgentId = Get-AgentId

# Handle Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Stop-Agent }

try {
    Start-Agent
}
catch {
    Write-Log "ERROR" "Agent error: $_"
    Stop-Agent
}
