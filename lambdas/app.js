const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient({ region: "us-west-2" }); 

const tableName = "CdkProjectStack-testTableFD9E8557-EL3RO2KEQF6C"; 

async function queryDynamoDB() {
    try {
        const partitionKeyName = 'id';
        const partitionValue = 'Test';
      const params = {
        TableName: tableName,
        KeyConditionExpression: `${partitionKeyName} = :partitionValue`,
          ExpressionAttributeValues: marshall({
              ":partitionValue": partitionValue
          })
      };
  
      const command = new QueryCommand(params);
      const response = await client.send(command);
  
      if (response.Items) {
        const items = response.Items.map((item) => unmarshall(item));
        console.log("Items:", items);
        return items;
      } else {
        console.log("No items found.");
        return [];
      }
    } catch (error) {
      console.error("Error querying DynamoDB:", error);
      return [];
    }
  }

exports.handlerMethod = async(event, context) => {
    const items = await queryDynamoDB();
    console.log(items);
    const name = process.env.NAME;
    const city = process.env.CITY;
    return `Hello CDK! ${name} from ${city}`
}
