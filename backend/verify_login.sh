#!/bin/sh
curl -v -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' http://localhost:4000/api/auth/login
