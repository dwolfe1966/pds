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

4. **David Wolfe**
   - Location: San Francisco, CA
   - ZIP: 94102
   - Age: 38

5. **Tim Chin**
   - Location: Seattle, WA
   - ZIP: 98101
   - Age: 29

6. **Jerome Ang**
   - Location: Boston, MA
   - ZIP: 02116
   - Age: 45

7. **Kwan Park**
   - Location: Austin, TX
   - ZIP: 78701
   - Age: 33

## How to Search

### Basic Search (No ZIP)
- `John Smith` ✅
- `Jane Johnson` ✅
- `Michael Williams` ✅
- `David Wolfe` ✅
- `Tim Chin` ✅
- `Jerome Ang` ✅
- `Kwan Park` ✅

### Search with ZIP (More Specific)
- `John Smith` with ZIP `10001` ✅
- `Jane Johnson` with ZIP `90210` ✅
- `Michael Williams` with ZIP `60601` ✅
- `David Wolfe` with ZIP `94102` ✅
- `Tim Chin` with ZIP `98101` ✅
- `Jerome Ang` with ZIP `02116` ✅
- `Kwan Park` with ZIP `78701` ✅

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

## Additional Variations

Each of the guaranteed names also has **10 additional variations** generated automatically, so you'll get multiple results for each search. For example, searching for "David Wolfe" will return 11 results (1 guaranteed + 10 variations).

## Testing

After restarting the server, these seven names are **guaranteed** to work:
- `John Smith`
- `Jane Johnson`
- `Michael Williams`
- `David Wolfe`
- `Tim Chin`
- `Jerome Ang`
- `Kwan Park`

Each search will return multiple results (1 guaranteed entry + 10 variations = 11 total results per name).

