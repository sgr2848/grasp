#!/bin/bash

# GRASP Deployment Script
# Deploys both API (Railway) and Web (Vercel via GitHub)

set -e

echo "🚀 GRASP Deployment"
echo "==================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
    read -p "Do you want to commit all changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message: " commit_msg
        git add -A
        git commit -m "$commit_msg"
    else
        echo -e "${RED}Aborting deployment. Please commit or stash changes first.${NC}"
        exit 1
    fi
fi

# Push to GitHub (triggers Vercel)
echo ""
echo -e "${GREEN}📦 Pushing to GitHub (triggers Vercel deploy)...${NC}"
git push origin main

# Deploy API to Railway
echo ""
echo -e "${GREEN}🚂 Deploying API to Railway...${NC}"
cd apps/api
railway up --service GraspITAPI
cd ../..

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 Check deployment status:"
echo "   - Vercel: https://vercel.com/dashboard"
echo "   - Railway: https://railway.app/dashboard"
