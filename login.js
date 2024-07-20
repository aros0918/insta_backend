async function login(page, username, password) {
  console.log('Navigating to Instagram login page...');
  await page.goto('https://www.instagram.com/accounts/login/');
  await page.waitForSelector('input[name="username"]');

  console.log('Entering username and password...');
  await page.type('input[name="username"]', username);
  await page.type('input[name="password"]', password);

  console.log('Submitting login form...');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);

  console.log('Checking if login was successful...');
  const loginError = await page.$('p[data-testid="login-error-message"]');
  if (loginError) {
    const errorMessage = await page.evaluate(el => el.textContent, loginError);
    throw new Error(`Login failed: ${errorMessage}`);
  }

  console.log('Login successful!');
  return page;
}

module.exports = { login };