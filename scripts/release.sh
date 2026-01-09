#!/bin/bash
#
# Seal Release Script
#
# Creates an immutable release:
# 1. Builds the web app
# 2. Publishes to IPFS
# 3. Pins on Pinata
# 4. Configures mobile apps to load from the pinned CID
#
# Usage:
#   ./scripts/release.sh [--skip-mobile]
#
# Environment:
#   PINATA_JWT - Pinata API JWT (or set in .env.local)
#
# The CID is the version. Each run produces one immutable release.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
echo_info() { echo -e "${GREEN}▶${NC} $1"; }
echo_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
echo_error() { echo -e "${RED}✖${NC} $1"; }
echo_success() { echo -e "${GREEN}✔${NC} $1"; }

SKIP_MOBILE=false
for arg in "$@"; do
    case $arg in
        --skip-mobile) SKIP_MOBILE=true ;;
    esac
done

# Load environment
if [ -z "$PINATA_JWT" ] && [ -f "$PROJECT_DIR/.env.local" ]; then
    echo_info "Loading .env.local..."
    set -a
    source "$PROJECT_DIR/.env.local"
    set +a
fi

# Validate requirements
command -v ipfs >/dev/null 2>&1 || { echo_error "ipfs CLI required"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo_error "curl required"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo_error "jq required"; exit 1; }

if [ -z "$PINATA_JWT" ]; then
    echo_error "PINATA_JWT not set"
    exit 1
fi

# Get version from package.json
VERSION=$(jq -r '.version' "$PROJECT_DIR/package.json")
echo_info "Releasing Seal v$VERSION"

#
# Step 1: Build
#
echo_step "Building Web App"
cd "$PROJECT_DIR"
npm run build
echo_success "Build complete"

#
# Step 2: Add to IPFS
#
echo_step "Publishing to IPFS"
CID=$(ipfs add -r --cid-version=1 --quieter "$DIST_DIR")
echo_success "Added to local IPFS"
echo "  CIDv1: $CID"

#
# Step 3: Upload to Pinata
#
echo_step "Pinning on Pinata"

# Build upload command
CURL_ARGS=()
while IFS= read -r -d '' file; do
    rel_path="${file#$DIST_DIR/}"
    CURL_ARGS+=(-F "file=@$file;filename=dist/$rel_path")
done < <(find "$DIST_DIR" -type f -print0)

RESPONSE=$(curl -s -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
    -H "Authorization: Bearer $PINATA_JWT" \
    "${CURL_ARGS[@]}" \
    -F "pinataMetadata={\"name\":\"Seal v$VERSION\",\"keyvalues\":{\"version\":\"$VERSION\",\"type\":\"release\"}}" \
    -F "pinataOptions={\"cidVersion\":1}")

if echo "$RESPONSE" | grep -q '"error"'; then
    echo_error "Pinata upload failed"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

PINATA_CID=$(echo "$RESPONSE" | jq -r '.IpfsHash')
echo_success "Pinned: $PINATA_CID"

# Use Pinata CID as canonical (includes dist/ wrapper)
RELEASE_CID="$PINATA_CID"

#
# Step 4: Verify
#
echo_step "Verifying Release"
GATEWAY_URL="https://$RELEASE_CID.ipfs.dweb.link/"

echo_info "Testing gateway: $GATEWAY_URL"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$GATEWAY_URL")

if [ "$HTTP_STATUS" = "200" ]; then
    echo_success "Gateway accessible (HTTP $HTTP_STATUS)"
else
    echo_warn "Gateway returned HTTP $HTTP_STATUS (may need propagation time)"
fi

#
# Step 5: Configure Mobile Apps
#
if [ "$SKIP_MOBILE" = false ]; then
    echo_step "Configuring Mobile Apps"
    
    export SEAL_IPFS_URL="$GATEWAY_URL"
    echo_info "SEAL_IPFS_URL=$SEAL_IPFS_URL"
    
    npm run build
    npx cap sync
    
    echo_success "Mobile apps configured"
    echo_info "Run 'npx cap open ios' or 'npx cap open android' to build"
fi

#
# Step 6: Save Release Info
#
echo_step "Release Complete"

RELEASE_FILE="$PROJECT_DIR/RELEASE.txt"
cat > "$RELEASE_FILE" << EOF
Seal Release
============

Version: v$VERSION
Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

CID: $RELEASE_CID

Gateway URLs:
  https://$RELEASE_CID.ipfs.dweb.link/
  https://ipfs.io/ipfs/$RELEASE_CID/
  https://cloudflare-ipfs.com/ipfs/$RELEASE_CID/
  https://gateway.pinata.cloud/ipfs/$RELEASE_CID/

Mobile Apps:
  SEAL_IPFS_URL=https://$RELEASE_CID.ipfs.dweb.link/
  
  Build commands:
    npm run cap:ios      # Open Xcode
    npm run cap:android  # Open Android Studio

Verification Checklist:
  [ ] Web app loads from gateway
  [ ] Vault creation works
  [ ] Unlock behavior works
  [ ] Backup/restore works
  [ ] iOS app loads from CID
  [ ] Android app loads from CID
  [ ] Network failure shows error honestly
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Release v$VERSION Published${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "CID: $RELEASE_CID"
echo ""
echo "Gateway: $GATEWAY_URL"
echo ""
echo "Mobile:  SEAL_IPFS_URL=$GATEWAY_URL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo_success "Release info saved to RELEASE.txt"
