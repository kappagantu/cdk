import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnParameter, Fn, CfnCondition } from 'aws-cdk-lib/core';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { join } from 'path';
import * as fs from 'fs';
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb';


export class CdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.deployFile().then((deploymentJson) => {
      let landaList : Function[] = [];
      if (deploymentJson?.lambdas != null && deploymentJson?.lambdas?.length > 0) {
        landaList = this.deployLambdas(deploymentJson);
      }
      if (deploymentJson?.tables != null && deploymentJson?.tables?.length > 0) {
        this.createTables(deploymentJson, landaList);
      }
    });
  }

  private createTables(deploymentJson: any, landaList: Function[]) {
    let tables = deploymentJson?.tables;
    for (let i = 0; i < tables.length; i++) {
      let myTable = tables[i];
      const tableProps: dynamodb.TableProps = {
        partitionKey: {
          name: myTable.primaryKey,
          type: dynamodb.AttributeType.STRING,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY
      };

      const table = new dynamodb.Table(this, myTable.name, tableProps);

      if (myTable.ttlEnabled) {
        const cfnDynamoTable = table.node.defaultChild as dynamodb.CfnTable;
        cfnDynamoTable.timeToLiveSpecification = {
          enabled: true,
          attributeName: "TTL",
        };
        for( let i = 0; i < landaList.length; i++) {
          table.grantReadWriteData(landaList[i]);
        }
      }
    }
  }

  private deployLambdas(deploymentJson: any) {
    let landaList : Function[] = [];
    let lambdas = deploymentJson?.lambdas;
    for (let i = 0; i < lambdas.length; i++) {
      let mylambda = lambdas[i];
      let lambdaName = this.generateUniqueId(`${mylambda.service}-lambda`);
      const handler = new Function(this, lambdaName, {
        runtime: this.getLambdaLanguage(mylambda),
        memorySize: parseInt(mylambda?.memory) ?? 512,
        handler: mylambda?.handler ?? 'app.handler',
        code: this.getLambdaCode(mylambda),
        environment: mylambda?.environmentProperties,
      });
      landaList.push(handler);
      new cdk.CfnOutput(this, `lambda-arn-${lambdaName}`, { value: handler.functionArn });
    }
    return landaList;
  }

  private generateUniqueId(prefix: string): string {
    return prefix; //`${prefix}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private getLambdaCode(jsonObject: { [key: string]: any }): cdk.aws_lambda.Code {
    let codePath = jsonObject?.codePath;
    if (jsonObject?.codePath != null) {
      return Code.fromAsset(jsonObject?.codePath);
    }
    return Code.fromAsset(join(__dirname, '../lambdas'));
  }

  private getLambdaLanguage(jsonObject: { [key: string]: any }): cdk.aws_lambda.Runtime {
    let runtime = Runtime.NODEJS_18_X
    if (jsonObject?.language == "java") {
      runtime = Runtime.JAVA_21;
    }
    return runtime;
  }

  private async deployFile() {
    const deployFilePath = './deploy.json';
    const jsonData = await fs.promises.readFile(deployFilePath, 'utf8');
    const data = JSON.parse(jsonData);
    console.log(' data ', data);
    return data;
  }
}
