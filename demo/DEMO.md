# QErrors Functional Demo Guide

## 🚀 Quick Start

### 1. Start the Demo Server
```bash
npm run demo-server
```

### 2. Access the Demo
Open your browser and navigate to:
```
http://localhost:8080/demo.html
```

## 📋 Demo Overview

This comprehensive demo showcases all QErrors intelligent error handling middleware features through an interactive web interface.

## 🎯 Main Features

### **Core Functionality**
- **Error Handling**: Test various error types, severity levels, and context management
- **AI Analysis**: Configure and test AI-powered error analysis with different providers
- **Advanced Logging**: Comprehensive logging with multiple levels, formats, and rotation
- **Circuit Breaker**: Test resilience patterns for external services
- **Queue Management**: Asynchronous processing with concurrency control
- **Intelligent Caching**: LRU cache for AI advice and performance optimization
- **Environment Management**: Configuration validation and health checks

### **Testing & Monitoring**
- **Test Scenarios**: Predefined test suites for comprehensive validation
- **Performance Testing**: Benchmark and analyze system performance
- **Real-time Monitoring**: Live metrics and system health visualization

## 🔧 Demo Sections

### 1. **📊 Overview**
- Real-time system metrics
- Quick action buttons
- Live activity feed
- System health status

### 2. **⚠️ Error Handling**
- **Error Types**: Validation, Authentication, System errors
- **Severity Levels**: Low, Medium, High, Critical
- **Context Handling**: Rich context information testing
- **Sanitization**: Security and data protection testing

### 3. **🤖 AI Analysis**
- Model configuration (OpenAI, Google)
- Health checks and connection testing
- Individual and batch error analysis
- Performance metrics and caching

### 4. **📝 Advanced Logging**
- Log level testing (Debug, Info, Warn, Error, Fatal, Audit)
- Format testing (JSON, Text, Structured)
- Log rotation and file management
- Real-time log streaming

### 5. **⚡ Circuit Breaker**
- Configuration management
- State control (Closed, Open, Half-Open)
- Load testing and failure simulation
- Performance metrics

### 6. **📋 Queue Management**
- Concurrency configuration
- Queue status monitoring
- Load testing and overflow simulation
- Performance analysis

### 7. **💾 Intelligent Caching**
- Cache configuration (limit, TTL)
- Performance testing
- Hit/miss ratio analysis
- Eviction and expiration testing

### 8. **🔧 Environment Management**
- Environment health checks
- Variable validation
- Security testing
- Configuration management

### 9. **🧪 Test Scenarios**
- Quick start tests
- Integration testing
- Stress testing
- Security validation

### 10. **⚡ Performance Testing**
- Throughput benchmarking
- Latency analysis
- Concurrency testing
- Resource usage monitoring

### 11. **📈 Real-time Monitoring**
- Live system metrics
- Configurable update intervals
- Performance visualization
- Health monitoring

## 🎮 Interactive Features

### **Status Indicators**
- Server health status
- AI model availability
- Cache system status
- Queue processing status

### **Real-time Metrics**
- Total error count
- AI suggestion count
- Cache hit rate
- Queue length
- Circuit breaker state
- System uptime

### **Test Controls**
- One-click test execution
- Configuration forms
- Batch operations
- Stress testing

### **Log Streaming**
- Real-time log display
- Multiple log containers
- Export functionality
- Color-coded severity levels

## 🔍 Testing Scenarios

### **Basic Error Flow**
1. Click "Test Basic Error"
2. Observe error creation and logging
3. Check AI analysis suggestions
4. Review error context handling

### **Circuit Breaker Testing**
1. Configure circuit breaker parameters
2. Test with different failure scenarios
3. Observe state transitions
4. Monitor recovery behavior

### **Performance Testing**
1. Select benchmark type
2. Choose load level
3. Run performance test
4. Analyze throughput and latency

### **Security Testing**
1. Test input sanitization
2. Verify error message redaction
3. Check sensitive data protection
4. Validate XSS prevention

## 📊 Metrics Available

### **System Metrics**
- CPU usage
- Memory consumption
- Error rate
- Request rate
- Queue length
- Cache hit rate

### **Performance Metrics**
- Throughput (req/sec)
- Average latency
- Error rate (%)
- Memory usage
- Response times

### **AI Metrics**
- Response time
- Success rate
- Cache hits
- Total requests

## 🛠 Configuration Options

### **Environment Variables**
The demo respects the following QErrors configuration:
- `QERRORS_CONCURRENCY`: Concurrency limit
- `QERRORS_CACHE_LIMIT`: Cache size limit
- `QERRORS_CACHE_TTL`: Cache TTL in seconds
- `QERRORS_QUEUE_LIMIT`: Maximum queue size
- `OPENAI_API_KEY`: OpenAI API key (for AI analysis)
- `GEMINI_API_KEY`: Google Gemini API key (for AI analysis)

### **Demo Configuration**
- `DEMO_PORT`: Server port (default: 8080)

## 🚨 Important Notes

### **AI Analysis Setup**
To test AI-powered analysis:
1. Set `OPENAI_API_KEY` or `GEMINI_API_KEY` in your environment
2. Configure the provider in the AI Analysis section
3. Run health check to verify connection

### **Performance Considerations**
- The demo simulates backend functionality
- Real performance may vary with actual QErrors implementation
- Stress tests are simulated and may not reflect actual system limits

### **Security Features**
- All sensitive data is automatically redacted in logs
- Input sanitization is demonstrated
- Error message sanitization prevents information leakage

## 📱 Responsive Design

The demo is fully responsive and works on:
- Desktop browsers
- Tablet devices
- Mobile devices

## 🔧 Troubleshooting

### **Common Issues**

1. **Server Not Starting**
   ```bash
   # Check if port is in use
   lsof -i :8080
   
   # Use different port
   DEMO_PORT=8081 npm run demo-server
   ```

2. **AI Analysis Not Working**
   - Verify API keys are set
   - Check network connectivity
   - Review AI provider configuration

3. **Metrics Not Updating**
   - Ensure JavaScript is enabled
   - Check browser console for errors
   - Refresh the page

## 📝 API Integration

The demo frontend can be extended to work with actual QErrors backend API endpoints. Currently, it simulates all functionality for demonstration purposes.

## 🎯 Best Practices Demonstrated

1. **Error Handling Patterns**
   - Consistent error response formats
   - Proper error classification
   - Context preservation

2. **Security Practices**
   - Input sanitization
   - Sensitive data redaction
   - XSS prevention

3. **Performance Optimization**
   - Caching strategies
   - Circuit breaker usage
   - Queue management

4. **Monitoring & Observability**
   - Comprehensive logging
   - Real-time metrics
   - Health checks

## 🚀 Next Steps

1. **Backend Integration**: Connect demo to actual QErrors API
2. **Custom Tests**: Add domain-specific test scenarios
3. **Performance Tuning**: Optimize for production environments
4. **Monitoring Integration**: Connect to external monitoring systems

## 📞 Support

For issues or questions about the QErrors middleware:
- GitHub: https://github.com/Bijikyu/qerrors
- Documentation: Check the project README
- Issues: Report via GitHub issues

---

**Note**: This demo is a frontend simulation designed to showcase QErrors functionality. For production use, integrate with the actual QErrors middleware backend.