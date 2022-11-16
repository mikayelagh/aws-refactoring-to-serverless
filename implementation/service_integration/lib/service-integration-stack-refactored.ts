import { Stack, StackProps,RemovalPolicy,Duration, CfnOutput } from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';



export class ServiceIntegrationStackRefactored extends Stack {
  private IMAGE_TO_LABEL: string = '255911618.jpeg';
  private BUCKET_NAME: string = "service-integration-refactored";

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const imageBucket = new s3.Bucket(this, 'DestinationBucket', {
      bucketName: this.BUCKET_NAME,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const s3Object = new s3deploy.BucketDeployment(this, 'DeployImage', {
      sources: [s3deploy.Source.asset('./images')],
      destinationBucket: imageBucket,
    });
    
    const detectObject = new tasks.CallAwsService(this, 'Detect Object',{
        service: 'rekognition',
        action: 'detectLabels',
        parameters: {
          Image: {
            S3Object: {
              Bucket: imageBucket.bucketName,
              Name: this.IMAGE_TO_LABEL
            }
          }
        },
        iamResources:['*'],          
        additionalIamStatements: [
          new iam.PolicyStatement({
          actions: ['s3:getObject'],
          resources: [`${imageBucket.bucketArn}/${this.IMAGE_TO_LABEL}`]
          })
        ]
      });

      const extractName = new sfn.Pass(this, 'Extract Name', {
        parameters: { 
          "food.$": "$.Labels[0].Name"
        }
      });

      const failed = new sfn.Fail(this, 'Quality Control Failed');
      const passed = new sfn.Succeed(this, 'Quality Control Passed');

      
      const definition = detectObject
      .next(extractName)
      .next(new sfn.Choice(this, 'Is Pizza?')
        .when(sfn.Condition.stringEquals('$.food', 'Pizza'), passed)
        .otherwise(failed)
      )
  
      const stepFunction = new sfn.StateMachine(this, 'workflow', {
        stateMachineName: 'FoodQualityControl-Refactored',
        definition: definition,
        timeout: Duration.seconds(30)
      });

      new CfnOutput(this,'ArnForStepFunction-Refactored',{value: stepFunction.stateMachineArn});
  }
    
}