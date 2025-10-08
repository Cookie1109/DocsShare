const mysql = require('mysql2/promise');

async function debugTagsDatabase() {
    try {
        // Database connection - using backend config
        require('dotenv').config();
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('=== TAGS TABLE ===');
        const [tags] = await db.execute('SELECT * FROM tags ORDER BY id DESC LIMIT 10');
        console.log('Tags found:', tags);

        console.log('\n=== FILE_TAGS TABLE ===');
        const [fileTags] = await db.execute('SELECT * FROM file_tags ORDER BY id DESC LIMIT 10');
        console.log('File-Tags relations:', fileTags);

        console.log('\n=== GROUP_MAPPING TABLE ===');
        const [groupMapping] = await db.execute('SELECT * FROM group_mapping ORDER BY id DESC LIMIT 10');
        console.log('Group mapping:', groupMapping);

        console.log('\n=== FILES TABLE (recent) ===');
        const [files] = await db.execute('SELECT id, name, group_id FROM files ORDER BY id DESC LIMIT 5');
        console.log('Recent files:', files);

        console.log('\n=== JOIN QUERY - Files with Tags ===');
        const [filesWithTags] = await db.execute(`
            SELECT f.id as file_id, f.name as file_name, t.id as tag_id, t.name as tag_name, f.group_id
            FROM files f
            LEFT JOIN file_tags ft ON f.id = ft.file_id
            LEFT JOIN tags t ON ft.tag_id = t.id
            ORDER BY f.id DESC LIMIT 10
        `);
        console.log('Files with tags:', filesWithTags);

        await db.end();
    } catch (error) {
        console.error('Database error:', error);
    }
}

debugTagsDatabase();