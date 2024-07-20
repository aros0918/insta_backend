const { Database } = require('./db');
const { mongoUri } = require('./config');

const db = new Database(mongoUri, 'Application');

const regiserUser = async (email, password) => {
    const user = {
        createdAt: Date.now(),
        email,
        password,
        currentPlan : "Free",
        credits : 0,
        subID : null,
    };

    await db.create('users', user);
};

const getUserByEmail = async (email) => {
    return await db.findOne('users', { email });
};


const updateUserPlanAndCredits = async (email, newPlan, oldCredits, subscriptionId) => {
    let credits;
    if (newPlan === "Kickstarter") {
        credits = oldCredits + 1000;
    } else if (newPlan === "Pro") {
        credits = oldCredits + 2500;
    } else {
        credits = oldCredits;
    }

    const updateResult = await db.update('users', { email }, { $set: { currentPlan: newPlan, credits: credits, subID : subscriptionId } });

    if (updateResult.modifiedCount === 1) {
        console.log(`User ${email} updated with new plan: ${newPlan}`);
        return `User ${email} updated with new plan: ${newPlan}`;
    } else {
        console.error(`Failed to update user ${email}`);
        return `Failed to update user ${email}`;
    }
};

const updateCredits = async (email, newCredits) => {
    const updateResult = await db.update('users', { email }, { $set: { credits: newCredits } });
    if (updateResult.modifiedCount === 1) {
        console.log(`User ${email} updated with new credits: ${newCredits}`);
        return `User ${email} updated with new credits: ${newCredits}`;
    } else {
        console.error(`Failed to update user ${email}`);
        return `Failed to update user ${email}`;
    }
}

module.exports = { regiserUser, getUserByEmail, updateCredits, updateUserPlanAndCredits };
