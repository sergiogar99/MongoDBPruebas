import { MongoClient, ObjectID } from "mongodb";
import { GraphQLServer } from "graphql-yoga";

import "babel-polyfill";

//"mongodb+srv://sergio:123pez@cluster0-dikpx.gcp.mongodb.net/test?retryWrites=true&w=majority"

const usr = "sergio";
const pwd = "123pez";
const url = "cluster0-dikpx.gcp.mongodb.net/test?retryWrites=true&w=majority";

/**
 * Connects to MongoDB Server and returns connected client
 * @param {string} usr MongoDB Server user
 * @param {string} pwd MongoDB Server pwd
 * @param {string} url MongoDB Server url
 */
const connectToDb = async function(usr, pwd, url) {
  const uri = `mongodb+srv://${usr}:${pwd}@${url}`;
  
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await client.connect();
  return client;
};

/**
 * Starts GraphQL server, with MongoDB Client in context Object
 * @param {client: MongoClinet} context The context for GraphQL Server -> MongoDB Client
 */
const runGraphQLServer = function(context) {
  const typeDefs = `
    type Query{
      getAuthor(id: ID!): Author
      getAuthors: [Author]!
    }

    type Mutation{
      addAuthor(name: String!, age: Int!):Author!

      addMany(name:[String!],age:[Int!]):[Author!]

      updateAuthor(id:ID!,name:String,age:Int):Author!
      removeAuthor(id:ID!):String
      removeAll:String
    }

    type Author{
      _id: ID!
      name: String!
      age: Int!
    }
    `;

  const resolvers = {
    Query: {
      getAuthor: async (parent, args, ctx, info) => {
        const { id } = args;
        const { client } = ctx;
        const db = client.db("blog");
        const collection = db.collection("authors");
        const result = await collection.findOne({ _id: ObjectID(id) });
        return result;
      },
      getAuthors: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const db = client.db("blog");
        const collection = db.collection("authors");
        const result = await collection.find({}).toArray();
        return result;
      }
    },
    Mutation: {

      addAuthor: async (parent, args, ctx, info) => {
        const { name, age } = args;
        const { client } = ctx;

        const db = client.db("blog");
        const collection = db.collection("authors");
        const result = await collection.insertOne({ name, age });

        return {
          name,
          age,
          _id: result.ops[0]._id
        };
      },
      addMany:async (parent, args, ctx, info) => {

        let autores = [];
        let autor;

        for(let i = 0;i<args.name.length;i++){

          autor = {
            "name":args.name[i],
            "age":args.age[i]
          }
          autores.push(autor);
        }
 
        const { client } = ctx;

        const db = client.db("blog");
        const collection = db.collection("authors");
        const result = await collection.insertMany(autores);

        console.log(result);

        return result.ops;

      },
      updateAuthor:async (parent, args, ctx, info) => {


        const { client } = ctx;
        const db = client.db("blog");
        const collection = db.collection("authors");

        let result;
        let data = await collection.findOne({ _id: ObjectID(args.id)});

        if(args.name && args.age){

          result = await collection.updateOne({"_id":ObjectID(args.id)},{$set:{name:args.name,age:args.age}});
          result = await collection.findOne({ _id: ObjectID(args.id)});

          return result;

        } else if(args.name){

          result = await collection.updateOne({"_id":ObjectID(args.id)},{$set:{name:args.name,age:data.age}});
          result = await collection.findOne({ _id: ObjectID(args.id)});
          return result;

        }else if(args.age){

          result = await collection.updateOne({"_id":ObjectID(args.id)},{$set:{name:data.name,age:args.age}});
          result = await collection.findOne({ _id: ObjectID(args.id)});
          return result;
          
        }
      },
      removeAuthor:async(parent, args, ctx, info) => {

        const { client } = ctx;
        const db = client.db("blog");
        const collection = db.collection("authors");

        await collection.deleteOne({ _id: { $eq: ObjectID(args.id) } });

      },
      removeAll:async(parent, args, ctx, info) => {

        const { client } = ctx;
        const db = client.db("blog");
        const collection = db.collection("authors");
        
        await collection.deleteMany();

      }
    }
  };

  const server = new GraphQLServer({ typeDefs, resolvers, context });
  const options = {
    port: 8000
  };

  try {
    server.start(options, ({ port }) =>
      console.log(
        `Server started, listening on port ${port} for incoming requests.`
      )
    );
  } catch (e) {
    console.info(e);
    server.close();
  }
};

const runApp = async function() {
  const client = await connectToDb(usr, pwd, url);
  console.log("Connect to Mongo DB");
  try {
    runGraphQLServer({ client });
  } catch (e) {
    client.close();
  }
};

runApp();
