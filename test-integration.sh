#!/bin/bash
echo "Testing Frontend-Backend Integration"
echo "====================================="

echo "1. Testing API server availability..."
curl -s http://localhost:3001/api/data

echo -e "\n\n2. Testing health endpoint..."
curl -s http://localhost:3001/api/health

echo -e "\n\n3. Testing metrics endpoint..."
curl -s http://localhost:3001/api/metrics

echo -e "\n\n4. Testing validation endpoint..."
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"data":"test input"}' \
  http://localhost:3001/api/validate

echo -e "\n\n5. Testing error endpoint with JSON accept header..."
curl -s -H "Accept: application/json" http://localhost:3001/api/error

echo -e "\n\n6. Testing HTML escaping..."
curl -s http://localhost:3001/html/escape

echo -e "\n\n7. Testing concurrent operations..."
curl -s http://localhost:3001/concurrent

echo -e "\n\nIntegration tests completed!"