import pool from "../config/database.js";

const addForeignKeyConstraints = async () => {
    const client = await pool.connect();
    try {
        // Helper function to check if constraint exists
        const constraintExists = async (tableName, constraintName) => {
            const result = await client.query(`
                SELECT 1 
                FROM information_schema.table_constraints 
                WHERE table_name = $1 
                AND constraint_name = $2
            `, [tableName, constraintName]);
            return result.rows.length > 0;
        };

        // Helper function to safely add constraint
        const safeAddConstraint = async (tableName, constraintName, constraintSQL) => {
            const exists = await constraintExists(tableName, constraintName);
            if (!exists) {
                await client.query(constraintSQL);
                console.log(`Added constraint ${constraintName} to ${tableName}`);
            } else {
                console.log(`Constraint ${constraintName} already exists on ${tableName}`);
            }
        };

        // Users foreign keys
        await safeAddConstraint(
            'users',
            'fk_users_department',
            `ALTER TABLE "users" 
             ADD CONSTRAINT fk_users_department 
             FOREIGN KEY ("departmentId") REFERENCES departments("departmentId")`
        );

        // Departments foreign keys
        await safeAddConstraint(
            'departments',
            'fk_departments_users',
            `ALTER TABLE departments 
             ADD CONSTRAINT fk_departments_users 
             FOREIGN KEY ("createdBy") REFERENCES users("userId")`
        );

        // Chatroomusers foreign keys and unique constraint
        await safeAddConstraint(
            'chatroomusers',
            'fk_chatroomusers_rooms',
            `ALTER TABLE chatroomusers 
             ADD CONSTRAINT fk_chatroomusers_rooms 
             FOREIGN KEY ("roomId") REFERENCES chatrooms("roomId")`
        );

        await safeAddConstraint(
            'chatroomusers',
            'fk_chatroomusers_users',
            `ALTER TABLE chatroomusers 
             ADD CONSTRAINT fk_chatroomusers_users 
             FOREIGN KEY ("userId") REFERENCES users("userId")`
        );

        // For unique constraints, we can use IF NOT EXISTS
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.table_constraints 
                    WHERE table_name = 'chatroomusers' 
                    AND constraint_name = 'unique_room_user'
                ) THEN
                    ALTER TABLE chatroomusers 
                    ADD CONSTRAINT unique_room_user UNIQUE("roomId", "userId");
                END IF;
            END $$;
        `);

        // Chat Messages foreign keys with cascade
        await safeAddConstraint(
            'chatmessages',
            'fk_chatmessages_rooms',
            `ALTER TABLE chatmessages 
             ADD CONSTRAINT fk_chatmessages_rooms 
             FOREIGN KEY ("roomId") REFERENCES chatrooms("roomId") ON DELETE CASCADE`
        );

        await safeAddConstraint(
            'chatmessages',
            'fk_chatmessages_users',
            `ALTER TABLE chatmessages 
             ADD CONSTRAINT fk_chatmessages_users 
             FOREIGN KEY ("senderId") REFERENCES users("userId") ON DELETE CASCADE`
        );

        await safeAddConstraint(
            'chatmessages',
            'fk_chatmessages_poll',
            `ALTER TABLE chatmessages 
             ADD CONSTRAINT fk_chatmessages_poll 
             FOREIGN KEY ("pollId") REFERENCES poll("id")`
        );

        await safeAddConstraint(
            'chatmessages',
            'fk_chatmessages_media',
            `ALTER TABLE chatmessages 
             ADD CONSTRAINT fk_chatmessages_media 
             FOREIGN KEY ("mediaFilesId") REFERENCES media("id")`
        );

        await safeAddConstraint(
            'chatmessages',
            'fk_chatmessages_table',
            `ALTER TABLE chatmessages 
             ADD CONSTRAINT fk_chatmessages_table 
             FOREIGN KEY ("tableId") REFERENCES "table"("id")`
        );

        // Add other constraints similarly...

    } catch (error) {
        console.error("Error adding foreign key constraints:", error);
        throw error;
    } finally {
        client.release();
    }
};

// Main initialization function with error handling
const initializeForeignKeyConstraints = async () => {
    try {
        await addForeignKeyConstraints();
    } catch (error) {
        console.error("Foreign initialization failed:", error);
        if (error.constraint) {
            console.error(`Constraint violation: ${error.constraint}`);
        }
        throw error;
    }
};

export default initializeForeignKeyConstraints;