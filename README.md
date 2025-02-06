## A Listing Google Crawler for Real Estate

This is a simple Google crawler that finds specifically, Zillow urls, navigate to the page - search the location - scroll to load all listings - extract the listings. It uses Puppeteer to navigate the Google search results and extract the listings.

### Installation

1. Clone the repository
```bash
git clone https://github.com/HungVPham/apt-listing.git
```

2. Install the dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

4. Make a request to the server via Postman
```bash
GET http://localhost:3000/api/test-workflow?search=top%20home%20listing%20websites&location=<location> # I run test with location=harlem,%20ga (91 listings with many duplicates, 3 pages, shouldn't take too long to complete)
```



