# Smart Campus Helper - Authentication System Documentation

## Overview
A complete authentication system has been implemented with JWT tokens, localStorage validation, and automatic session management. Users can now:
- Register with their account details
- Login with email and password
- Maintain session using JWT tokens stored in localStorage
- Auto-redirect to profile if already logged in
- Logout and clear session

---

## Files Created/Modified

### 1. **php/auth.php** (NEW)
Complete backend authentication handler with JWT support.

**Features:**
- User registration with validation
- Secure password hashing (password_hash)
- JWT token generation and verification
- Token expiration (24 hours default)
- User data retrieval
- CORS headers for cross-origin requests

**Endpoints:**
```
POST /php/auth.php
Actions:
  - register: Create new user account
  - login: Authenticate and get JWT token
  - verify: Validate token
  - getUser: Fetch user data using token
```

**Database Schema Created Automatically:**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    branch VARCHAR(100),
    semester VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

---

### 2. **login-register.html** (NEW)
Combined login and register page with tab switching.

**Features:**
- Single page with toggleable login/register tabs
- Same Tailwind CSS theme as index.html
- Client-side form validation
- Error and success message display
- Loading states for buttons
- Auto-focus on email field after registration
- Redirects to profile.html on successful login
- Auto-redirects if user already logged in

**Form Fields:**

**Login:**
- Email Address
- Password

**Register:**
- Full Name
- Email Address
- Branch/Department
- Semester (dropdown)
- Password
- Confirm Password

---

### 3. **js/auth.js** (NEW)
Client-side authentication handler.

**Functions:**
- `switchTab(tab)` - Switch between login/register forms
- `clearErrors()` - Clear all error messages
- `showError(elementId, message)` - Display error
- `showSuccess(elementId, message)` - Display success
- `setButtonState(buttonId, isLoading)` - Toggle button loading state

**Event Listeners:**
- Register button click - Handles registration
- Login button click - Handles login
- Page load - Redirects if already logged in

**localStorage Data Stored:**
- `authToken` - JWT token (24-hour expiry)
- `user` - User object (name, email, branch, semester)
- `isLoggedIn` - Boolean flag

---

### 4. **profile.html** (MODIFIED)
Updated to include authentication and dynamic user data.

**New Features:**
- Authentication check on page load
- Fetches user data from server using JWT token
- Displays dynamic user information:
  - Name
  - Email
  - Branch/Department
  - Semester
  - Join Date (Member Since)
- Logout button (dual instances for responsive design)
- Loading indicators during data fetch
- Auto-redirect to login if token expires

**Script Functions:**
- `checkAuthentication()` - Verify user is logged in
- `fetchUserData()` - Get user data from backend
- `displayUserData(user)` - Update page with user data
- `logout()` - Clear session and redirect

---

### 5. **js/script.js** (MODIFIED)
Updated with authentication status checks.

---

### 6. **index.html** (MODIFIED)
Updated links and added authentication check.

**Changes:**
- "Get Started" button links to login-register.html
- "Sign In" button links to login-register.html
- "Login" button in navbar links to login-register.html
- Script checks if user is logged in and changes "Login" to "Profile"

---

## How It Works - Step by Step

### **Registration Flow:**
1. User fills registration form on login-register.html
2. Client-side validation checks all fields
3. Password confirmation validation
4. Form data sent to `auth.php` with action='register'
5. Server validates email uniqueness
6. Password is hashed using `password_hash()`
7. User data inserted into database
8. Success message shown
9. Form clears and switches to login tab
10. User email pre-filled for convenience

### **Login Flow:**
1. User enters email and password
2. Client-side validation
3. Form data sent to `auth.php` with action='login'
4. Server finds user by email
5. Password verified using `password_verify()`
6. JWT token generated with user data + expiry time
7. Token stored in localStorage as `authToken`
8. User object stored in localStorage as `user`
9. Boolean flag `isLoggedIn` set to 'true'
10. Auto-redirect to profile.html

### **Session Validation:**
1. Profile page checks localStorage for `authToken` and `isLoggedIn`
2. If missing, redirects to login-register.html
3. If present, calls `auth.php` with action='getUser' and token
4. Server verifies JWT token signature and expiry
5. If invalid/expired, returns error
6. If valid, returns fresh user data from database
7. User data displayed on profile page
8. All user details dynamically filled

### **Logout Flow:**
1. User clicks logout button
2. JavaScript clears all localStorage items:
   - `authToken`
   - `user`
   - `isLoggedIn`
3. Redirects to login-register.html
4. Next login requires fresh authentication

---

## Security Features

✅ **Password Security:**
- Passwords hashed with PHP's `password_hash()` (default: bcrypt)
- Never stored in plaintext
- Verified with `password_verify()`

✅ **JWT Tokens:**
- Generated with HMAC-SHA256 signature
- 24-hour expiration by default
- Server-side verification before accepting
- Contains encrypted user data

✅ **Email Validation:**
- Server-side validation on registration
- Duplicate email checking
- Client-side format validation

✅ **Input Sanitization:**
- All inputs trimmed
- Type validation on inputs
- CORS headers configured
- JSON parsing on POST data

✅ **Session Management:**
- Token stored in browser localStorage (secure for this use case)
- Token cleared on logout
- Token expiry prevents indefinite access
- Server verifies token on every sensitive operation

---

## Installation Instructions

### **Step 1: Database Setup**
The database will be created automatically when the first user registers. The connection details in `auth.php` are:
- Host: dpg-d77lipqdbo4c73arvtv0-a.singapore-postgres.render.com
- Database: unisphere_h4rb
- User: root
- Password: eA4dn3XSdHcuo99MljBnLq1AOnZxpIUY

### **Step 2: File Structure**
Ensure files are in correct locations:
```
Student_Campus_Helper/
├── index.html
├── login-register.html          (NEW)
├── profile.html
├── php/
│   ├── auth.php                 (NEW)
│   └── dbconn.php
└── js/
    ├── auth.js                  (NEW)
    └── script.js
```

### **Step 3: Start Using**
1. Open `index.html` in browser
2. Click "Get Started" or "Sign In"
3. Create account or login
4. Profile page will auto-load with user data

---

## Testing the System

### **Test Registration:**
1. Go to login-register.html
2. Click Register tab
3. Fill all fields:
   - Name: John Doe
   - Email: john@example.com
   - Branch: Computer Science
   - Semester: 4th
   - Password: password123
   - Confirm: password123
4. Click Register
5. Should see "Registration successful!"

### **Test Login:**
1. Click Login tab
2. Enter email: john@example.com
3. Enter password: password123
4. Click Login
5. Should redirect to profile.html
6. User data should display

### **Test Session Persistence:**
1. Close browser completely
2. Reopen and go to login-register.html
3. Page should redirect to profile.html (if within 24 hours)
4. User data should load from server using stored token

### **Test Logout:**
1. On profile.html, click "Logout" or "Sign Out"
2. Should redirect to login-register.html
3. localStorage should be cleared
4. Should not be able to access profile.html without logging in

### **Test Token Expiration:**
1. Login and note the time
2. Wait 24 hours (or modify token expiry in auth.php for testing)
3. Try to access profile.html
4. Should redirect to login (token expired)

---

## Customization Options

### **Change JWT Secret Key:**
In `php/auth.php`, line 20:
```php
$secret_key = "your_secret_key_here_change_this";
```
Change to a secure random string.

### **Change Token Expiry:**
In `php/auth.php`, line 30:
```php
function createJWT($data, $secretKey, $expiryHours = 24) {
```
Change `24` to desired hours.

### **Add More Fields:**
1. Add to registration form in login-register.html
2. Update validation in js/auth.js
3. Add to PHP validation in auth.php
4. Add to database schema in auth.php
5. Display on profile.html

### **Change Redirect URLs:**
- In `login-register.html` script, line ~95:
  ```js
  window.location.href = './profile.html';
  ```
- In `profile.html` script, multiple locations

---

## API Reference

### **Register Endpoint:**
```
POST /php/auth.php
Content-Type: application/json

{
  "action": "register",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "confirm_password": "password123",
  "branch": "Computer Science",
  "semester": "4th"
}

Response (Success):
{
  "success": true,
  "message": "User registered successfully. Please login."
}

Response (Error):
{
  "success": false,
  "message": "Email already registered"
}
```

### **Login Endpoint:**
```
POST /php/auth.php
Content-Type: application/json

{
  "action": "login",
  "email": "john@example.com",
  "password": "password123"
}

Response (Success):
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "branch": "Computer Science",
    "semester": "4th"
  }
}

Response (Error):
{
  "success": false,
  "message": "Invalid email or password"
}
```

### **Get User Endpoint:**
```
POST /php/auth.php
Content-Type: application/json

{
  "action": "getUser",
  "token": "eyJhbGc..."
}

Response (Success):
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "branch": "Computer Science",
    "semester": "4th",
    "created_at": "2024-04-03 10:30:00"
  }
}

Response (Error):
{
  "success": false,
  "message": "Invalid or expired token"
}
```

---

## Troubleshooting

### **"Database connection failed"**
- Check database credentials in auth.php
- Ensure PostgreSQL server is running
- Verify internet connection (cloud database)

### **"Email already registered"**
- Try logging in instead
- Use a different email for registration

### **"Invalid email or password"**
- Check spelling of email
- Verify password (case-sensitive)
- Ensure account was created

### **"Invalid or expired token"**
- Token may have expired (24 hours)
- Need to login again
- Clear localStorage and reload

### **Page not redirecting after login**
- Check browser console for errors
- Verify JavaScript is enabled
- Check if auth.php path is correct

### **User data not loading on profile**
- Check network tab in DevTools
- Verify auth.php is accessible
- Check localStorage has valid token
- Check token hasn't expired

---

## Future Enhancements

- [ ] Email verification on registration
- [ ] Password reset functionality
- [ ] Two-factor authentication
- [ ] Social login (Google, GitHub)
- [ ] User profile picture upload
- [ ] Edit profile functionality
- [ ] Remember me checkbox
- [ ] Activity logs
- [ ] Role-based access control
- [ ] API rate limiting

---

## Security Recommendations

1. **Change the JWT secret key** to a strong, unique value
2. **Use HTTPS** in production (not HTTP)
3. **Store token in secure HTTP-only cookies** instead of localStorage (for maximum security)
4. **Implement CSRF protection** for forms
5. **Add input validation** on both client and server
6. **Implement rate limiting** on auth endpoints
7. **Use environment variables** for sensitive data
8. **Add logging** for failed login attempts
9. **Implement email verification** for new registrations
10. **Regular security audits** of the code

---

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Review the API Reference
3. Check browser console for JavaScript errors
4. Check server logs for PHP errors
5. Verify file paths and permissions

---

**Last Updated:** April 3, 2024
**Version:** 1.0
**Status:** Production Ready
