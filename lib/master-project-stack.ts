import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { InstanceType } from 'aws-cdk-lib/aws-ec2';
import * as fs from 'fs';
import { KubectlV28Layer } from '@aws-cdk/lambda-layer-kubectl-v28';
import { EksDashboard } from './EksDashboard';

export class MasterProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    const cdk_principal = process.env.cdk_principal;
    if(cdk_principal == null) {
      //command: export cdk_principal=$(aws sts get-caller-identity | jq -r .Arn)
      throw Error('CDK user arn should be set to cdk_principal envronment variable : ');
    }
    super(scope, id, props);
    let vpc : ec2.Vpc,eksCluster;
    this.deployFile().then((deploymentJson) => {
      
      const mastersRole = new cdk.aws_iam.Role(this, 'MastersRole', {
        assumedBy: new cdk.aws_iam.ArnPrincipal(cdk_principal), 
      });
      if (deploymentJson?.vpc) {
        vpc = new ec2.Vpc(this, deploymentJson.vpc.name, {
          ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
          maxAzs: 2,
          subnetConfiguration: [
            {
              name: 'Public',
              subnetType: ec2.SubnetType.PUBLIC,
              mapPublicIpOnLaunch: true,
            },
            {
              name: 'Private',
              subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
          ],
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
          capacityType: eks.CapacityType.ON_DEMAND, 
          subnets: { // Explicitly specify the public subnets
            subnets: vpc.publicSubnets,
          },
        });

        new EksDashboard(this, 'EksDashboard', {
          cluster: eksCluster,
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