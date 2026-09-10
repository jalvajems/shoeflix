#!/bin/bash

# Exit on any error
set -e

echo "=========================================================="
echo " Starting Shoeflix EC2 Server Configuration Script"
echo "=========================================================="

# 1. Update and Upgrade System Packages
echo "--> Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Git and Build Essentials
echo "--> Installing git and build-essential..."
sudo apt install -y git build-essential curl

# 3. Install Node.js v20 LTS
echo "--> Installing Node.js v20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Install PM2 (Process Manager)
echo "--> Installing PM2 globally..."
sudo npm install -g pm2

# 5. Install Nginx (Web Server)
echo "--> Installing Nginx..."
sudo apt install -y nginx

# 6. Install Certbot (SSL)
echo "--> Installing Certbot and Nginx plugin..."
sudo apt install -y certbot python3-certbot-nginx

echo "=========================================================="
echo " Installations Completed Successfully!"
echo " Verification:"
echo "   Node: $(node -v)"
echo "   NPM:  $(npm -v)"
echo "   PM2:  $(pm2 -v)"
echo "   Nginx: $(nginx -v)"
echo "=========================================================="
echo "Next Steps:"
echo "1. Run your application using PM2."
echo "2. Configure Nginx reverse proxy at /etc/nginx/sites-available/default."
echo "3. Run certbot for SSL: sudo certbot --nginx"
echo "=========================================================="
