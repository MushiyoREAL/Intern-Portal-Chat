import express from 'express';
import bcrypt from 'bcrypt';
import pkg from 'pg';
import session from 'express-session';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vamps',
    password: process.env.DB_PASSWORD || '666',
    port: process.env.DB_PORT || 61203,
});

app.use(express.json());

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'your_secret_key',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
    })
);

// Serve the React static files
app.use(express.static(path.resolve('uikit-react-example/dist')));

app.get('*', (req, res) => {
    res.sendFile(path.resolve('uikit-react-example/dist/index.html'));
});

app.post('/login', async (req, res) => {
    const { email, password, userType } = req.body;
    console.log('Login request received:', { email, userType });

    try {
        // Determine the query based on userType
        const userQuery =
            userType === 'school'
                ? 'SELECT * FROM school WHERE email = $1'
                : userType === 'company'
                ? 'SELECT * FROM company WHERE email = $1'
                : 'SELECT * FROM intern WHERE email = $1';

        const userResult = await pool.query(userQuery, [email]);
        console.log('Database query result:', userResult.rows);

        if (userResult.rows.length === 0) {
            console.error('User not found for email:', email);
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        console.log('Password match result:', passwordMatch);

        if (!passwordMatch) {
            console.error('Password mismatch for email:', email);
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Check if SendBird user data exists in the new table
        const sendbirdQuery = 'SELECT * FROM sendbird_user_data WHERE user_id = $1';
        const sendbirdResult = await pool.query(sendbirdQuery, [user.id]);

        if (sendbirdResult.rows.length === 0) {
            // Create user in SendBird and store SendBird data in database
            try {
                const sendbirdResponse = await axios.post(
                    `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3/users`,
                    {
                        user_id: user.id.toString(),
                        nickname: user.name,
                        profile_url: user.profile_picture || '',
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Api-Token': process.env.SENDBIRD_API_TOKEN,
                        }
                    }
                );

                console.log(`User ${user.name} successfully created in SendBird.`);

                // Insert SendBird data into the new table
                const sendbirdId = sendbirdResponse.data.user_id;
                const insertQuery = `
                    INSERT INTO sendbird_user_data (user_id, sendbird_id, nickname, profile_url)
                    VALUES ($1, $2, $3, $4)`;
                await pool.query(insertQuery, [user.id, sendbirdId, user.name, user.profile_picture || '']);

                console.log(`SendBird ID ${sendbirdId} saved to sendbird_user_data table.`);
            } catch (sendbirdError) {
                console.error(
                    'Error creating user in SendBird:',
                    sendbirdError.response?.data || sendbirdError.message
                );
                return res.status(500).json({ error: 'Failed to create user in SendBird.' });
            }
        } else {
            // Update SendBird user details
            try {
                const sendbirdId = sendbirdResult.rows[0].sendbird_id;
                await axios.put(
                    `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3/users/${sendbirdId}`,
                    {
                        nickname: user.name,
                        profile_url: user.profile_picture || '',
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Api-Token': process.env.SENDBIRD_API_TOKEN,
                        }
                    }
                );
                console.log(`SendBird user ${sendbirdId} successfully updated.`);
            } catch (sendbirdError) {
                console.error(
                    'Error updating user in SendBird:',
                    sendbirdError.response?.data || sendbirdError.message
                );
                return res.status(500).json({ error: 'Failed to update user in SendBird.' });
            }
        }

        // Save session data
        req.session.userId = user.id;
        req.session.userType = userType;

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Session error.' });
            }

            console.log(`User logged in successfully: ID ${user.id}, Type: ${userType}`);
            res.json({
                success: true,
                userId: user.id.toString(),
                userType: userType,
            });
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
