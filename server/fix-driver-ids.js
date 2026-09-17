import 'dotenv/config';
import mongoose from 'mongoose';

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;

        // Find ALL drivers
        const drivers = await db.collection('user').find({ role: 'driver' }).toArray();
        console.log(`Found ${drivers.length} driver(s):`);
        drivers.forEach(d => console.log(`  - ${d.name} | ${d.email} | id: ${d._id}`));

        if (drivers.length === 0) {
            console.log('❌ No drivers. Create one in Manage Drivers first.');
            process.exit(1);
        }

        const mainDriver = drivers[0];
        console.log(`\nUsing main driver: ${mainDriver.name} (${mainDriver._id})\n`);

        // Update ALL trips with fake/missing driver
        const result = await db.collection('trips').updateMany(
            {
                $or: [
                    { driver: 'seed-driver-1' },
                    { driver: null },
                    { driver: '' },
                    { driver: { $exists: false } },
                ],
            },
            { $set: { driver: String(mainDriver._id) } }
        );

        console.log(`✅ Updated ${result.modifiedCount} trips with real driver ID`);

        // Verify
        const total = await db.collection('trips').countDocuments();
        const fixed = await db.collection('trips').countDocuments({ driver: String(mainDriver._id) });
        console.log(`\n📊 Total trips: ${total}`);
        console.log(`📊 Trips with real driver: ${fixed}`);

        await mongoose.connection.close();
        console.log('\n✅ Done');
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
})();
