#!/bin/bash

echo "🧪 Testing File Serving Configuration"
echo "======================================"
echo ""

# Check if server is running
echo "1. Checking if backend is accessible..."
if curl -s -I "https://senior-backend-ebwu.onrender.com/health" | grep -q "200 OK"; then
    echo "   ✅ Backend is online"
else
    echo "   ⚠️  Backend might be offline or starting up"
fi
echo ""

# Test file serving with existing test files
echo "2. Testing file serving..."

# Test PDF
echo "   Testing PDF (test-file-123.pdf)..."
PDF_STATUS=$(curl -s -I "https://senior-backend-ebwu.onrender.com/uploads/onduty-documents/test-file-123.pdf" | grep "HTTP" | awk '{print $2}')
PDF_TYPE=$(curl -s -I "https://senior-backend-ebwu.onrender.com/uploads/onduty-documents/test-file-123.pdf" | grep -i "content-type" | awk '{print $2}')
echo "      Status: $PDF_STATUS"
echo "      Content-Type: $PDF_TYPE"

if [ "$PDF_STATUS" = "200" ]; then
    echo "      ✅ PDF serving works!"
else
    echo "      ⚠️  PDF not found (Status: $PDF_STATUS)"
fi
echo ""

# Test Image (PNG)
echo "   Testing Image (test-image.png)..."
IMG_STATUS=$(curl -s -I "https://senior-backend-ebwu.onrender.com/uploads/onduty-documents/test-image.png" | grep "HTTP" | awk '{print $2}')
IMG_TYPE=$(curl -s -I "https://senior-backend-ebwu.onrender.com/uploads/onduty-documents/test-image.png" | grep -i "content-type" | awk '{print $2}')
echo "      Status: $IMG_STATUS"
echo "      Content-Type: $IMG_TYPE"

if [ "$IMG_STATUS" = "200" ]; then
    echo "      ✅ Image serving works!"
else
    echo "      ⚠️  Image not found (Status: $IMG_STATUS)"
fi
echo ""

# Check CORS headers
echo "3. Checking CORS headers..."
CORS_HEADER=$(curl -s -I "https://senior-backend-ebwu.onrender.com/uploads/onduty-documents/test-file-123.pdf" | grep -i "access-control-allow-origin")
if [ ! -z "$CORS_HEADER" ]; then
    echo "   ✅ CORS headers present: $CORS_HEADER"
else
    echo "   ⚠️  CORS headers missing"
fi
echo ""

# Check debug endpoint
echo "4. Checking upload directories..."
curl -s "https://senior-backend-ebwu.onrender.com/api/debug/uploads" | head -20
echo ""

echo "======================================"
echo "Test complete!"
