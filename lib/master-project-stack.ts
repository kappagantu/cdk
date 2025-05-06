import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { InstanceType } from 'aws-cdk-lib/aws-ec2';
import * as fs from 'fs';
import { KubectlV28Layer } from '@aws-cdk/lambda-layer-kubectl-v28';

export class MasterProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.deployFile().then((deploymentJson) => {
      let vpc,eksCluster;
      const mastersRole = new cdk.aws_iam.Role(this, 'MastersRole', {
        assumedBy: new cdk.aws_iam.ArnPrincipal('arn:aws:iam::942306984159:user/serverless-admin'), 
      });
      if (deploymentJson?.vpc) {
        vpc = new ec2.Vpc(this, deploymentJson.vpc.name, {
          ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
          maxAzs: 2,
        });
      }
      if(deploymentJson?.eks) {
        eksCluster = new eks.Cluster(this, deploymentJson.eks.name, {
          mastersRole,
          vpc: vpc,
          vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
          version: eks.KubernetesVersion.V1_28,
          defaultCapacity: 0,
          clusterLogging: [
            eks.ClusterLoggingTypes.API,
            eks.ClusterLoggingTypes.AUTHENTICATOR,
            eks.ClusterLoggingTypes.AUDIT,
          ],
          kubectlLayer: new KubectlV28Layer(this, 'kubectl')
        });

        eksCluster.addNodegroupCapacity('custom-node-group', {
          nodegroupName: "custom-node-group",
          instanceTypes: [new ec2.InstanceType('t3.medium')],
          minSize: eksCluster.node.tryGetContext("node_group_min_size"),
          desiredSize: 1,
          maxSize: eksCluster.node.tryGetContext("node_group_max_size"),
          diskSize: 100,
          amiType: eks.NodegroupAmiType.AL2_X86_64,
          capacityType: eks.CapacityType.SPOT, 
        });
    
      }
    });
  }
  private async deployFile() {
    const deployFilePath = './master-stack-config.json';
    const jsonData = await fs.promises.readFile(deployFilePath, 'utf8');
    const data = JSON.parse(jsonData);
    console.log(' data ', data);
    return data;
  }
}