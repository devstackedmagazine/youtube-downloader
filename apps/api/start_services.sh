#!/bin/bash
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable --now docker
sudo docker-compose -f ../../docker-compose.yml up -d
