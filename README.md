# AWS CDK Deployment Project (TypeScript)

This project leverages the [AWS Cloud Development Kit (CDK)](https://docs.aws.amazon.com/cdk/) in **TypeScript** to dynamically provision infrastructure components based on a deployment configuration file (`deploy.json`).

## What It Does

The CDK stack includes:

* **AWS Lambda Functions** (Node.js or Java)
* **Amazon DynamoDB Tables** (with optional TTL)
* **Base Amazon EKS (Elastic Kubernetes Service) Cluster**

Resources are created dynamically based on the configuration in `deploy.json`.

---

## Project Structure

```
.
├── cdk/
│   ├── bin/
│   │   └── cdk-project.ts                   # CDK app entry point
│   └── lib/
│       └── cdk-project-stack.ts     # CDK stack logic (Lambda, DynamoDB, EKS)
├── lambdas/                         # Default Lambda code location
├── deploy.json                      # Deployment configuration file
├── package.json
└── tsconfig.json
```

> **Entry point for the CDK app** is `cdk/lib/cdk-project-stack.ts`.

---

## Configuration: `deploy.json`

The infrastructure is defined in a single file: `deploy.json`.

### Example:

```json
{
  "lambdas": [
    {
      "service": "user-service",
      "language": "node",
      "codePath": "./lambdas/user",
      "handler": "index.handler",
      "memory": "512",
      "environmentProperties": {
        "ENV": "prod"
      }
    }
  ],
  "tables": [
    {
      "name": "UserTable",
      "primaryKey": "userId",
      "ttlEnabled": true
    }
  ],
  "eks": {
    "enabled": true,
    "clusterName": "BaseCluster",
    "version": "1.29"
  }
}
```

---

## Supported Features

### Lambda Functions

* Dynamically created from `deploy.json`
* Supports both Node.js (`node`) and Java (`java`)
* Code location, handler, memory, and environment can be customized

### DynamoDB Tables

* Partition key support
* Optional TTL configuration (based on a `TTL` attribute)
* Grants read/write access to deployed Lambdas

### EKS Cluster

* If `eks.enabled` is `true`, a base EKS cluster is created
* Configurable cluster name and Kubernetes version

---

## Deployment Steps

1. **Install dependencies:**

```bash
npm install
```

2. **Bootstrap your AWS environment** (required once per environment):

```bash
cdk bootstrap
```

3. **Deploy the stack:**

```bash
cdk deploy
```

---

## Clean Up

To tear down the entire infrastructure:

```bash
cdk destroy
```

---

## Notes

* Lambdas and tables are deployed **only if** defined in `deploy.json`.
* TTL functionality requires a `TTL` field in your data (e.g., UNIX epoch time).
* EKS cluster creation is controlled by the `eks.enabled` flag.
* All outputs such as Lambda ARNs and DynamoDB table names are printed after deployment.

---

## License

This project is licensed under the **MIT License**.

---
