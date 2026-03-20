import { DomainParkingDetector } from "../domainParkingDetector";
import type { WhoisData } from "../types";

describe("DomainParkingDetector", () => {
  const mockWhoisData: WhoisData = {
    domain: "example.com",
    found: true,
    registrar: "Test Registrar",
    creationDate: "2020-01-01",
    expirationDate: "2025-01-01",
    updatedDate: "2023-01-01",
    domainAgeDays: 1000,
    nameServers: ["ns1.example.com", "ns2.example.com"],
    domainStatus: ["ok"]
  };

  describe("isParked", () => {

    it("should detect parked domain based on HTML content keywords", () => {
      const htmlContent = `
        <html>
          <body>
            <h1>This domain is for sale</h1>
            <p>Contact us to buy this domain</p>
            <div>Related searches</div>
          </body>
        </html>
      `;

      const result = DomainParkingDetector.isParked(mockWhoisData, htmlContent);

      expect(result).toBe(true);
    });

    it("should detect parked domain based on name server patterns", () => {
      const whoisWithParkingNS: WhoisData = {
        ...mockWhoisData,
        nameServers: ["ns1.parklogic.com", "ns2.parklogic.com"],
        registrar: "Sedo", // Add registrar points (2)
        domainStatus: ["client delete prohibited", "client transfer prohibited"] // Add status points (1)
        // Total: 3 (nameserver) + 2 (registrar) + 1 (status) = 6 points >= 5
      };

      const result = DomainParkingDetector.isParked(whoisWithParkingNS, "");

      expect(result).toBe(true);
    });

    it("should detect parked domain based on registrar patterns", () => {
      const whoisWithParkingRegistrar: WhoisData = {
        ...mockWhoisData,
        registrar: "Sedo",
        nameServers: ["ns1.parklogic.com"], // Add name server points
        domainStatus: ["client delete prohibited"] // Add status points
      };

      const result = DomainParkingDetector.isParked(whoisWithParkingRegistrar, "");

      expect(result).toBe(true);
    });

    it("should not detect as parked for legitimate website", () => {
      const htmlContent = `
        <html>
          <head>
            <title>Welcome to Our Business</title>
          </head>
          <body>
            <h1>About Our Company</h1>
            <p>We provide excellent services to our customers.</p>
            <nav>
              <a href="/products">Products</a>
              <a href="/contact">Contact</a>
            </nav>
          </body>
        </html>
      `;

      const result = DomainParkingDetector.isParked(mockWhoisData, htmlContent);

      expect(result).toBe(false);
    });

    it("should not detect as parked for legitimate registrar and name servers", () => {
      const legitimateWhois: WhoisData = {
        ...mockWhoisData,
        registrar: "GoDaddy",
        nameServers: ["ns1.godaddy.com", "ns2.godaddy.com"]
      };

      const result = DomainParkingDetector.isParked(legitimateWhois, "");

      expect(result).toBe(false);
    });

    it("should handle empty HTML content", () => {
      const result = DomainParkingDetector.isParked(mockWhoisData, "");

      expect(result).toBe(false);
    });

    it("should handle null HTML content", () => {
      const result = DomainParkingDetector.isParked(mockWhoisData, null as any);

      expect(result).toBe(false);
    });

    it("should detect multiple parking indicators", () => {
      const htmlContent = `
        <html>
          <body>
            <h1>Domain for sale</h1>
            <p>Buy this domain now</p>
            <div>Premium domain available</div>
            <span>Under construction</span>
          </body>
        </html>
      `;

      const result = DomainParkingDetector.isParked(mockWhoisData, htmlContent);

      expect(result).toBe(true);
    });

    it("should be case insensitive for HTML content", () => {
      const htmlContent = `
        <html>
          <body>
            <h1>DOMAIN FOR SALE</h1>
            <p>BUY THIS DOMAIN</p>
            <div>CONTACT US TO BUY THIS DOMAIN</div>
          </body>
        </html>
      `;

      const result = DomainParkingDetector.isParked(mockWhoisData, htmlContent);

      expect(result).toBe(true);
    });

    it("should detect parking based on specific name server patterns", () => {
      const parkingNameServers = [
        "ns1.sedo.com",
        "ns1.parkingcrew.com",
        "ns1.afternic.com",
        "ns1.bodis.com",
        "ns1.above.com",
        "ns1.namecheap.com",
        "ns1.dan.com",
        "ns1.fabulous.com",
        "ns1.domainactive.com",
        "ns1.undeveloped.com"
      ];

      parkingNameServers.forEach(nameServer => {
        const whoisWithParkingNS: WhoisData = {
          ...mockWhoisData,
          nameServers: [nameServer, "ns2.example.com"],
          registrar: "Sedo", // Add registrar points (2)
          domainStatus: ["client delete prohibited", "client transfer prohibited"] // Add status points (1)
          // Total: 3 (nameserver) + 2 (registrar) + 1 (status) = 6 points >= 5
        };

        const result = DomainParkingDetector.isParked(whoisWithParkingNS, "");
        expect(result).toBe(true);
      });
    });

    it("should detect parking based on specific registrar patterns", () => {
      const parkingRegistrars = [
        "Dot Holding",
        "Fabulous",
        "Namecheap",
        "Sedo"
      ];

      parkingRegistrars.forEach(registrar => {
        const whoisWithParkingRegistrar: WhoisData = {
          ...mockWhoisData,
          registrar,
          nameServers: ["ns1.parklogic.com"], // Add name server points
          domainStatus: ["client delete prohibited"] // Add status points
        };

        const result = DomainParkingDetector.isParked(whoisWithParkingRegistrar, "");
        expect(result).toBe(true);
      });
    });

    it("should handle partial matches in HTML content", () => {
      const htmlContent = `
        <html>
          <body>
            <h1>This domain may be for sale</h1>
            <p>Inquire about this domain</p>
            <div>Make an offer on this domain</div>
          </body>
        </html>
      `;

      const result = DomainParkingDetector.isParked(mockWhoisData, htmlContent);

      expect(result).toBe(true);
    });

    it("should not detect false positives in legitimate content", () => {
      const htmlContent = `
        <html>
          <body>
            <h1>Our Products</h1>
            <p>We sell premium quality items</p>
            <div>Contact us for more information</div>
            <span>Our services are coming soon</span>
          </body>
        </html>
      `;

      const result = DomainParkingDetector.isParked(mockWhoisData, htmlContent);

      expect(result).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle whois data with missing fields", () => {
      const incompleteWhois: WhoisData = {
        domain: "example.com",
        found: false,
        registrar: "",
        creationDate: "",
        expirationDate: "",
        updatedDate: "",
        domainAgeDays: 0,
        nameServers: [],
        domainStatus: []
      };

      const result = DomainParkingDetector.isParked(incompleteWhois, "");

      expect(result).toBe(false);
    });

    it("should handle very long HTML content", () => {
      const longHtmlContent = "a".repeat(10000) + "domain for sale buy this domain contact us to buy this domain" + "b".repeat(10000);

      const result = DomainParkingDetector.isParked(mockWhoisData, longHtmlContent);

      expect(result).toBe(true);
    });

    it("should handle HTML with special characters", () => {
      const htmlContent = `
        <html>
          <body>
            <h1>Domain &amp; for sale</h1>
            <p>Buy this domain &lt;now&gt;</p>
            <div>Related &quot;searches&quot;</div>
            <span>Contact us to buy this domain</span>
            <div>This domain may be for sale</div>
          </body>
        </html>
      `;

      const result = DomainParkingDetector.isParked(mockWhoisData, htmlContent);

      expect(result).toBe(true);
    });
  });
});