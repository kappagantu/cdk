exports.handler = async(event, context) => {
    const name = process.env.NAME;
    const city = process.env.CITY;
    return `Hello CDK! ${name} from ${city}`
}