Digital Wallet POC: Setup Guide

This guide outlines the standard procedure for setting up the Digital Wallet Proof of Concept (POC) environment after cloning a new branch.
1. Prerequisites

    Ensure the following are installed and configured on your local machine:

        Version Control: Git
        Database: PostgreSQL (v15 or higher)
        Runtime: Node.js (LTS)
        Package Manager: npm (or pnpm/yarn)

2. Initial Setup

    Follow these steps to initialize the project locally:

        Step 1: Clone the Repository
            Bash
            git clone <repository-url>
            cd <project-directory>

        Step 2: Install Dependencies
            Download and install the required libraries for the project:
            Bash

            npm install

3. Configuration

The application relies on environment variables for database connectivity and server settings.

    - Create Environment File
    - Update Credentials:
        Open the .env file and provide your local PostgreSQL credentials:

        DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

4. Database Initialization

Before running the application, you must set up the database schema and seed initial data.

    Create the Database:
    SQL

    CREATE DATABASE digital_wallet_db;

    Run Schema Scripts:
    Execute the core SQL files (found in the /scripts folder) to create the necessary tables and indices.
    Execute in this order
        1. users.sql
        2. wallets.sql
        3. transactions.sql

    Seed Data:
    Populate the database with test users and initial balances to verify the setup.


5. Running the Application

Once the setup is complete, you can start the service:
Bash

# Development mode with hot-reloading
npm start

The service should now be accessible at the port specified in your .env file (e.g., 3003).
6. Verification
    Logs: Verify the database connection by checking the application logs in the terminal.
    Health Check: Test a sample endpoint (e.g., /mock/test) to ensure the server is responding correctly.