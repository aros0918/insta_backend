const { MongoClient } = require('mongodb');

/**
 *
 *
 * @class Database
 */
class Database {
    client;
    db;

    constructor(uri, db) {
        this.client = new MongoClient(uri);
        this.db = db;
    }

    async connect() {
        try {
            await this.client.connect();
            console.log('Database connected');
        } catch (err) {
            throw new Error(err);
        }
    }

    async close() {
        try {
            await this.client.close();
            console.log('Database connection closed');
        } catch (err) {
            throw new Error(err);
        }
    }

    async dropDatabase() {
        try {
            await this.client.db(this.db).dropDatabase();
        } catch (err) {
            throw new Error(err);
        }
    }

    async createCollection(collection, options) {
        try {
            await this.client.db(this.db).createCollection(collection, options);
        } catch (err) {
            throw new Error(err);
        }
    }

    async createIndex(collection, index, opts) {
        try {
            await this.client.db(this.db).collection(collection).createIndex(index, opts);
        } catch (err) {
            throw new Error(err);
        }
    }

    async create(collection, data) {
        try {
            const result = await this.client.db(this.db).collection(collection).insertOne(data);
            return result.insertedId;
        } catch (err) {
            throw new Error(err);
        }
    }

    async findOne(collection, query) {
        try {
            const result = await this.client.db(this.db).collection(collection).findOne(query);
            return result;
        } catch (err) {
            throw new Error(err);
        }
    }

    async update(collection, query, update) {
        try {
            const result = await this.client.db(this.db).collection(collection).updateOne(query, update);
            return result;
        } catch (err) {
            throw new Error(err);
        }
    }

    async delete(collection, query) {
        try {
            const result = await this.client.db(this.db).collection(collection).deleteOne(query);
            return result;
        } catch (err) {
            throw new Error(err);
        }
    }
}

module.exports = { Database };
