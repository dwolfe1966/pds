# Test Credentials and Search Terms

## Login Credentials

### Member Account
- **Email**: `member@test.com`
- **Password**: `password123`

### Admin Account
- **Email**: `admin@test.com`
- **Password**: `admin123`

Both accounts are pre-verified and ready to use.

## Search Terms That Work

The seed data generates 100 random people with names from these lists:

### First Names Available:
John, Jane, Michael, Sarah, David, Emily, Robert, Jessica, William, Ashley, James, Amanda, Christopher, Melissa, Daniel, Nicole, Matthew, Michelle, Anthony, Kimberly

### Last Names Available:
Smith, Johnson, Williams, Brown, Jones, Garcia, Miller, Davis, Rodriguez, Martinez, Hernandez, Lopez, Wilson, Anderson, Thomas, Taylor, Moore, Jackson, Martin, Lee

### Recommended Search Terms (Try These):

**Common combinations that should return results:**
- `John Smith`
- `Jane Johnson`
- `Michael Williams`
- `Sarah Brown`
- `David Jones`
- `Emily Garcia`
- `Robert Miller`
- `Jessica Davis`

**Note:** Since names are randomly generated, not all combinations will exist. Try multiple searches with different first/last name combinations from the lists above.

### Search Examples:

1. **Basic Search:**
   - First Name: `John`
   - Last Name: `Smith`
   - ZIP: (optional)

2. **Search with ZIP:**
   - First Name: `Jane`
   - Last Name: `Johnson`
   - ZIP: `10001` (or any 5-digit number)

3. **Try Different Names:**
   If one doesn't work, try another combination from the lists above.

## Testing the API Directly

### Test Login:
```bash
curl -X POST http://localhost:3001/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@test.com","password":"password123"}'
```

### Test Search:
```bash
curl "http://localhost:3001/api/v1/search?firstName=John&lastName=Smith"
```

## Troubleshooting

### Login Not Working
1. Make sure the server is running: `cd server && node index.js`
2. Check server console for error messages
3. Verify credentials match exactly (case-sensitive)
4. The login issue has been fixed - restart the server to get the fix

### Search Not Returning Results
1. Try different name combinations
2. The search is case-insensitive and does partial matching
3. Try searching with just first name or last name
4. Check server console to see the search query received

