import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { URL } from 'url';

interface EksDashboardProps {
  cluster: eks.Cluster;
}

export class EksDashboard extends Construct {
  constructor(scope: Construct, id: string, props: EksDashboardProps) {
    super(scope, id);

    const cluster = props.cluster;

    // Create the kubernetes-dashboard namespace
    const dashboardNamespace = cluster.addManifest('kubernetes-dashboard-namespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'kubernetes-dashboard',
      },
    });

    // Create a Kubernetes ServiceAccount for the dashboard
    const serviceAccount = cluster.addServiceAccount('kubernetes-dashboard-sa', {
      name: 'kubernetes-dashboard',
      namespace: 'kubernetes-dashboard',
    });

    // Bind the AmazonEKSClusterPolicy to the ServiceAccount
    serviceAccount.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'));

    // Apply the Kubernetes Dashboard deployment
    const dashboardDeployment = cluster.addManifest('kubernetes-dashboard-deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        labels: {
          k8sApp: 'kubernetes-dashboard',
        },
        name: 'kubernetes-dashboard',
        namespace: 'kubernetes-dashboard',
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            k8sApp: 'kubernetes-dashboard',
          },
        },
        template: {
          metadata: {
            labels: {
              k8sApp: 'kubernetes-dashboard',
            },
          },
          spec: {
            serviceAccountName: serviceAccount.serviceAccountName,
            containers: [
              {
                name: 'kubernetes-dashboard',
                image: 'kubernetesui/dashboard:v2.6.0',
                ports: [
                  {
                    containerPort: 8443,
                  },
                ],
                args: ['--namespace=kubernetes-dashboard', '--token-ttl=3600'],
                volumeMounts: [
                  {
                    name: 'kubernetes-dashboard-certs',
                    mountPath: '/certs',
                  },
                  {
                    name: 'dashboard-tmp',
                    mountPath: '/tmp',
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: '/',
                    port: 9090,
                    scheme: 'HTTP',
                  },
                  initialDelaySeconds: 30,
                  timeoutSeconds: 5,
                  periodSeconds: 10,
                  failureThreshold: 3,
                },
                securityContext: {
                  allowPrivilegeEscalation: false,
                  readOnlyRootFilesystem: true,
                  runAsUser: 1001,
                  runAsGroup: 1001,
                },
              },
            ],
            volumes: [
              {
                name: 'kubernetes-dashboard-certs',
                emptyDir: {},
              },
              {
                name: 'dashboard-tmp',
                emptyDir: {},
              },
            ],
          },
        },
      },
    });
    dashboardDeployment.node.addDependency(dashboardNamespace);

    // Apply the Kubernetes Dashboard service
    const dashboardService = cluster.addManifest('kubernetes-dashboard-service', {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        labels: {
          k8sApp: 'kubernetes-dashboard',
        },
        name: 'kubernetes-dashboard',
        namespace: 'kubernetes-dashboard',
      },
      spec: {
        ports: [
          {
            port: 443,
            targetPort: 9090,
            nodePort: 30001,
          },
        ],
        selector: {
          k8sApp: 'kubernetes-dashboard',
        },
        type: 'NodePort',
      },
    });

    cluster.addManifest('kubernetes-dashboard-rbac', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        name: 'kubernetes-dashboard',
        namespace: 'kubernetes-dashboard',
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['get', 'list', 'watch', 'create', 'update'],
        },
        {
          apiGroups: [''],
          resources: ['services'],
          verbs: ['get', 'list', 'watch'],
        },
        {
          apiGroups: [''],
          resources: ['configmaps'],
          verbs: ['get', 'list', 'watch'],
        },
        {
          apiGroups: ['apps'],
          resources: ['deployments', 'replicasets'],
          verbs: ['get', 'list', 'watch'],
        },
        {
          apiGroups: [''],
          resources: ['events'],
          verbs: ['list', 'watch'],
        },
        {
          apiGroups: ['networking.k8s.io'],
          resources: ['ingresses'],
          verbs: ['get', 'list', 'watch'],
        },
        {
          apiGroups: ['storage.k8s.io'],
          resources: ['persistentvolumeclaims', 'storageclasses'],
          verbs: ['get', 'list', 'watch'],
        },
        {
          apiGroups: [''],
          resources: ['namespaces'],
          verbs: ['get', 'list', 'watch'],
        },
        {
          apiGroups: ['rbac.authorization.k8s.io'],
          resources: ['roles', 'rolebindings'],
          verbs: ['get', 'list', 'watch'],
        },
      ],
    });

    cluster.addManifest('kubernetes-dashboard-rolebinding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        name: 'kubernetes-dashboard',
        namespace: 'kubernetes-dashboard',
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'kubernetes-dashboard',
          namespace: 'kubernetes-dashboard',
        },
      ],
      roleRef: {
        kind: 'Role',
        name: 'kubernetes-dashboard',
        apiGroup: 'rbac.authorization.k8s.io',
      },
    });

    cluster.addManifest('kubernetes-dashboard-clusterrole', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: {
        name: 'kubernetes-dashboard-read-only',
      },
      rules: [
        {
          apiGroups: ['*', ''],
          resources: [
            'pods',
            'deployments',
            'replicasets',
            'statefulsets',
            'daemonsets',
            'jobs',
            'cronjobs',
            'services',
            'endpoints',
            'ingresses',
            'persistentvolumeclaims',
            'persistentvolumes',
            'nodes',
            'namespaces',
            'roles',
            'rolebindings',
            'secrets',
            'configmaps',
            'events',
          ],
          verbs: ['get', 'list', 'watch'],
        },
      ],
    });

    cluster.addManifest('kubernetes-dashboard-clusterrolebinding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: 'kubernetes-dashboard-read-only',
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'kubernetes-dashboard',
          namespace: 'kubernetes-dashboard',
        },
      ],
      roleRef: {
        kind: 'ClusterRole',
        name: 'kubernetes-dashboard-read-only',
        apiGroup: 'rbac.authorization.k8s.io',
      },
    });

    // Deploy Metrics Server
    cluster.addManifest('metrics-server-deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'metrics-server',
        namespace: 'kube-system',
        labels: {
          'k8s-app': 'metrics-server',
        },
      },
      spec: {
        selector: {
          matchLabels: {
            'k8s-app': 'metrics-server',
          },
        },
        template: {
          metadata: {
            labels: {
              'k8s-app': 'metrics-server',
            },
          },
          spec: {
            serviceAccountName: 'metrics-server',
            volumes: [
              {
                name: 'tmp-dir',
                emptyDir: {},
              },
            ],
            containers: [
              {
                name: 'metrics-server',
                image: 'registry.k8s.io/metrics-server/metrics-server:v0.6.4', // Use the latest stable version
                args: [
                  '--kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname',
                  '--kubelet-use-node-status-port',
                  '--metric-resolution=15s',
                ],
                volumeMounts: [
                  {
                    name: 'tmp-dir',
                    mountPath: '/tmp',
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: '/livez',
                    port: 10250,
                    scheme: 'HTTPS',
                  },
                  initialDelaySeconds: 5,
                  timeoutSeconds: 5,
                },
              },
            ],
          },
        },
      },
    });

    cluster.addManifest('metrics-server-serviceaccount', {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: 'metrics-server',
        namespace: 'kube-system',
      },
    });

    cluster.addManifest('metrics-server-auth-reader', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: {
        name: 'metrics-server:system:auth-delegator',
      },
      rules: [
        {
          apiGroups: ['authentication.k8s.io'],
          resources: ['tokenreviews'],
          verbs: ['create'],
        },
        {
          apiGroups: ['authorization.k8s.io'],
          resources: ['subjectaccessreviews'],
          verbs: ['create'],
        },
      ],
    });

    cluster.addManifest('metrics-server-auth-reader-binding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: 'metrics-server:system:auth-delegator',
        namespace: 'kube-system',
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'metrics-server:system:auth-delegator',
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'metrics-server',
          namespace: 'kube-system',
        },
      ],
    });

    cluster.addManifest('metrics-server-resource-reader', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: {
        name: 'system:aggregated-metrics-reader',
        labels: {
          'rbac.authorization.k8s.io/aggregate-to-view': 'true',
          'rbac.authorization.k8s.io/aggregate-to-edit': 'true',
          'rbac.authorization.k8s.io/aggregate-to-admin': 'true',
        },
      },
      rules: [
        {
          apiGroups: ['metrics.k8s.io'],
          resources: ['nodes', 'pods'],
          verbs: ['get', 'list', 'watch'],
        },
      ],
    });

    cluster.addManifest('metrics-server-resource-reader-binding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: 'metrics-server:system:resource-reader',
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'system:aggregated-metrics-reader',
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'metrics-server',
          namespace: 'kube-system',
        },
      ],
    });
  }
}