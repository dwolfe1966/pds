# Guaranteed Search Terms That Return Results

The seed data now includes **guaranteed test people** that will always return results. These are created every time the server starts.

## Guaranteed Search Results

These names will **always** return results:

1. **John Smith**
   - Location: New York, NY
   - ZIP: 10001
   - Age: 35

2. **Jane Johnson**
   - Location: Los Angeles, CA
   - ZIP: 90210
   - Age: 32

3. **Michael Williams**
   - Location: Chicago, IL
   - ZIP: 60601
   - Age: 42

## How to Search

### Basic Search (No ZIP)
- `John Smith` ✅
- `Jane Johnson` ✅
- `Michael Williams` ✅

### Search with ZIP (More Specific)
- `John Smith` with ZIP `10001` ✅
- `Jane Johnson` with ZIP `90210` ✅
- `Michael Williams` with ZIP `60601` ✅

## Additional Random Names

The seed data also generates 97 additional random people with names from these lists:

**First Names:** John, Jane, Michael, Sarah, David, Emily, Robert, Jessica, William, Ashley, James, Amanda, Christopher, Melissa, Daniel, Nicole, Matthew, Michelle, Anthony, Kimberly

**Last Names:** Smith, Johnson, Williams, Brown, Jones, Garcia, Miller, Davis, Rodriguez, Martinez, Hernandez, Lopez, Wilson, Anderson, Thomas, Taylor, Moore, Jackson, Martin, Lee

Since these are randomly generated, not all combinations will exist. However, searching for common combinations like:
- `John Johnson`
- `Jane Smith`
- `Michael Brown`
- `Sarah Williams`

...may return results depending on what was randomly generated.

## Testing

After restarting the server, these three names are **guaranteed** to work:
- `John Smith`
- `Jane Johnson`
- `Michael Williams`

