# Mini SIEM Dashboard

A comprehensive Security Information and Event Management (SIEM) demonstration tool built with React, showcasing core concepts of security monitoring, threat detection, and incident response.

![SIEM Dashboard](https://img.shields.io/badge/Security-SIEM-green) ![React](https://img.shields.io/badge/React-18.x-blue) ![License](https://img.shields.io/badge/license-MIT-blue)

## 🎯 Purpose

This mini SIEM tool demonstrates understanding of:
- **Security Information and Event Management (SIEM)** principles
- **Endpoint security monitoring** and detection
- **Real-time threat intelligence** and alerting
- **Security analytics** and visualization
- **Incident response workflows**

## 🚀 Features

### 1. Real-Time Event Monitoring
- **Live event ingestion** simulation (3-second intervals)
- **Multi-severity classification**: Critical, Warning, Info
- **Event correlation** and pattern detection
- **Historical event log** with full audit trail

### 2. Threat Detection & Classification
The SIEM monitors various security event types:

- **Authentication Events**: Login attempts, failed authentications
- **Network Anomalies**: Suspicious connections, unusual traffic patterns
- **File Integrity Monitoring**: Critical file modifications
- **Process Monitoring**: Unauthorized process execution
- **Malware Detection**: Signature-based threat identification
- **Privilege Escalation**: Unauthorized elevation attempts
- **Data Exfiltration**: Large data transfer detection

### 3. Alert Management System
- **Automated alert generation** for critical events
- **Alert prioritization** based on severity
- **Status tracking** (Open/Closed)
- **Alert correlation** with source events
- **Incident response workflow**

### 4. Endpoint Security Monitoring
- **Comprehensive endpoint inventory**
- **Health status tracking** (Healthy/Compromised)
- **Operating system visibility**
- **Network address mapping**
- **Last-seen timestamps**

### 5. Security Analytics Dashboard
- **Threat distribution analysis**
- **Top targeted endpoints**
- **Detection rule effectiveness**
- **Real-time statistics**
- **Visual data representation**

## 🏗️ SIEM Architecture Components

### Data Collection Layer
```javascript
// Simulates log ingestion from multiple sources
const eventTypes = [
  'authentication', 'network', 'file_integrity', 
  'process', 'malware', 'privilege', 'data_exfil'
]
```

### Event Processing Engine
- **Normalization**: Standardizes events from different sources
- **Enrichment**: Adds context (endpoint info, user data)
- **Classification**: Assigns severity levels
- **Correlation**: Links related events

### Detection Engine
```javascript
// Critical event alerting
if (newEvent.severity === 'critical') {
  generateAlert(newEvent);
}
```

### Storage & Indexing
- In-memory event storage (last 100 events)
- Alert history maintenance (last 50 alerts)
- Efficient data retrieval and filtering

### Visualization Layer
- **Dashboard**: High-level security posture overview
- **Event Log**: Detailed audit trail
- **Alerts**: Active threat notifications
- **Endpoints**: Asset inventory and health
- **Analytics**: Threat intelligence and trends

## 🛡️ Key SIEM Concepts Demonstrated

### 1. Log Aggregation
Collects security events from multiple sources (endpoints, network devices, applications) into a centralized platform.

### 2. Event Correlation
Links related security events to identify patterns that might indicate sophisticated attacks:
- Multiple failed logins → Brute force attack
- File modification + Process creation → Malware infection
- Privilege escalation + Network connection → Lateral movement

### 3. Threat Intelligence
Categorizes and prioritizes threats based on:
- **Severity levels** (Critical, Warning, Info)
- **Event types** (Authentication, Network, Malware)
- **Attack patterns** (MITRE ATT&CK framework concepts)

### 4. Incident Response
Provides workflow for security incidents:
- **Detection**: Automated alert generation
- **Investigation**: Detailed event analysis
- **Response**: Alert status management
- **Documentation**: Complete audit trail

### 5. Compliance & Auditing
Maintains comprehensive logs for:
- Security compliance reporting
- Forensic analysis
- Incident post-mortems
- Regulatory requirements (HIPAA, PCI-DSS, SOX)

## 🔍 Endpoint Security Features

### Host-Based Monitoring
- **Process monitoring**: Tracks running processes for anomalies
- **File integrity**: Monitors critical system files
- **Network connections**: Tracks inbound/outbound traffic
- **User activity**: Monitors authentication and privilege use

### Security Posture Assessment
- Real-time endpoint health status
- Operating system inventory
- Network topology mapping
- Vulnerability tracking (conceptual)

## 💻 Technical Implementation

### Technologies Used
- **React 18** - Frontend framework
- **Lucide React** - Icon library
- **CSS-in-JS** - Styled components
- **Real-time simulation** - setInterval for live updates

### Key Components

#### Event Generator
```javascript
const generateEvent = (id) => {
  // Simulates realistic security events with:
  // - Timestamp
  // - Source endpoint
  // - Event type and severity
  // - User context
  // - Detailed description
}
```

#### Alert Correlation
```javascript
// Automatically creates alerts for critical events
if (newEvent.severity === 'critical') {
  setAlerts(prev => [{
    id: `ALT-${Date.now()}`,
    event: newEvent,
    status: 'open',
    timestamp: new Date().toISOString()
  }, ...prev]);
}
```

#### Endpoint Tracking
```javascript
const generateEndpoint = (id) => ({
  id: `EP-${id}`,
  hostname: 'server-name',
  ip: '192.168.x.x',
  os: 'Operating System',
  status: 'healthy | compromised',
  lastSeen: timestamp
})
```

## 🎨 UI/UX Design Decisions

### Cybersecurity Aesthetic
- **Color Scheme**: Dark theme with neon accents (green, red, orange, blue)
- **Typography**: Monospace font (JetBrains Mono) for technical authenticity
- **Animations**: Subtle pulsing indicators, grid background, smooth transitions
- **Visual Hierarchy**: Clear severity indicators, color-coded alerts

### Information Density
- **Dashboard**: High-level metrics for quick situational awareness
- **Event Log**: Detailed view with sortable, filterable data
- **Alerts**: Prioritized list with actionable items
- **Analytics**: Visual representations of security trends

## 📊 Use Cases

### Security Operations Center (SOC)
- Monitor real-time security events across infrastructure
- Identify and respond to active threats
- Track alert resolution and incident timelines

### Threat Hunting
- Analyze historical event data for IOCs (Indicators of Compromise)
- Identify patterns indicating advanced persistent threats (APTs)
- Correlate events across multiple endpoints

### Compliance Reporting
- Generate audit trails for compliance requirements
- Track security posture over time
- Document incident response activities

### Security Research
- Understand SIEM architecture and functionality
- Learn event correlation techniques
- Study threat detection methodologies

## 🚦 Getting Started

### Prerequisites
- Node.js 16+ (for local development)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mini-siem.git

# Navigate to project directory
cd mini-siem

# Install dependencies
npm install

# Start development server
npm start
```

### Using as React Artifact
Simply copy the `mini-siem.jsx` code into a React artifact environment and it will run immediately with no additional setup.

## 🔧 Customization

### Adding New Event Types
```javascript
const eventTypes = [
  { 
    type: 'your_new_type', 
    severity: 'warning', 
    description: 'Your event description' 
  }
];
```

### Adjusting Monitoring Frequency
```javascript
// Change the interval (in milliseconds)
const interval = setInterval(() => {
  // Event generation logic
}, 3000); // Default: 3 seconds
```

### Modifying Severity Colors
```javascript
const getSeverityColor = (severity) => {
  switch (severity) {
    case 'critical': return '#your_color';
    case 'warning': return '#your_color';
    case 'info': return '#your_color';
  }
}
```

## 📚 Learning Resources

### SIEM Concepts
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [MITRE ATT&CK Framework](https://attack.mitre.org/)
- [SANS Security Operations](https://www.sans.org/security-operations-center/)

### Endpoint Security
- [CIS Controls](https://www.cisecurity.org/controls/)
- [Endpoint Detection and Response (EDR)](https://www.crowdstrike.com/cybersecurity-101/endpoint-security/endpoint-detection-and-response-edr/)

### Real-World SIEM Tools
- **Splunk**: Industry-leading SIEM platform
- **Elastic SIEM**: Open-source security analytics
- **IBM QRadar**: Enterprise security intelligence
- **ArcSight**: HP's SIEM solution
- **LogRhythm**: Unified SIEM platform

## 🎓 Educational Value

This project demonstrates understanding of:

1. **Security Event Lifecycle**: Generation → Collection → Analysis → Response
2. **Threat Detection**: Signature-based and anomaly-based detection
3. **Data Analysis**: Log parsing, normalization, correlation
4. **Visualization**: Effective security dashboard design
5. **Incident Management**: Alert triage and response workflows
6. **Compliance**: Audit trails and reporting requirements

## 🔐 Security Considerations

While this is a demonstration tool, it incorporates realistic security concepts:

- **Data Classification**: Events categorized by severity
- **Access Control**: User context tracked for accountability
- **Audit Trail**: Complete event history maintained
- **Alert Management**: Proper incident response workflow
- **Endpoint Visibility**: Comprehensive asset inventory

## 🤝 Contributing

This is a portfolio/demonstration project, but improvements are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - feel free to use this project for learning and portfolio purposes.

## 👨‍💻 Author

Built as a demonstration of SIEM and endpoint security concepts for technical interviews and portfolio showcases.

## 🌟 Acknowledgments

- Inspired by enterprise SIEM platforms (Splunk, Elastic, QRadar)
- Design influenced by modern security operations centers
- Built with React and modern web technologies

---

**Note**: This is a demonstration tool using simulated data. It does not collect real security events or perform actual threat detection. Use it to understand SIEM concepts and showcase technical knowledge.
