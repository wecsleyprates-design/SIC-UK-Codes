import { WebsitePageCategorizer } from "../websitePageCategorizer";
import type { WebsitePageData } from "../types";

describe("WebsitePageCategorizer", () => {
  describe("getPrimaryCategory", () => {
    it("should categorize Product page correctly", () => {
      const productPage: WebsitePageData = {
        url: "https://example.com/products",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Our Products</h1><p>Shop our catalog of items</p>",
        textContent: "Our Products Shop our catalog of items",
        websiteTitleScraped: "Products - Example Store",
        websiteMetaDescription: "Browse our product catalog",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(productPage);

      expect(result).toBe("Product");
    });

    it("should categorize Service page correctly", () => {
      const servicePage: WebsitePageData = {
        url: "https://example.com/services",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Our Services</h1><p>Professional solutions for your business</p>",
        textContent: "Our Services Professional solutions for your business",
        websiteTitleScraped: "Services - Example Company",
        websiteMetaDescription: "Professional services and solutions",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(servicePage);

      expect(result).toBe("Service");
    });

    it("should categorize About page correctly", () => {
      const aboutPage: WebsitePageData = {
        url: "https://example.com/about",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>About Us</h1><p>Our company story and mission</p>",
        textContent: "About Us Our company story and mission",
        websiteTitleScraped: "About - Example Company",
        websiteMetaDescription: "Learn about our company",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(aboutPage);

      expect(result).toBe("About");
    });

    it("should categorize Contact page correctly", () => {
      const contactPage: WebsitePageData = {
        url: "https://example.com/contact",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Contact Us</h1><p>Get in touch with our team</p>",
        textContent: "Contact Us Get in touch with our team",
        websiteTitleScraped: "Contact - Example Company",
        websiteMetaDescription: "Contact information and locations",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(contactPage);

      expect(result).toBe("Contact");
    });

    it("should categorize Privacy/Legal page correctly", () => {
      const privacyPage: WebsitePageData = {
        url: "https://example.com/privacy",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Privacy Policy</h1><p>How we protect your data</p>",
        textContent: "Privacy Policy How we protect your data",
        websiteTitleScraped: "Privacy Policy - Example Company",
        websiteMetaDescription: "Our privacy policy and data protection",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(privacyPage);

      expect(result).toBe("Privacy/Legal");
    });

    it("should categorize Shopping page correctly", () => {
      const shoppingPage: WebsitePageData = {
        url: "https://example.com/shop",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Shop Now</h1><p>Add to cart and checkout</p>",
        textContent: "Shop Now Add to cart and checkout",
        websiteTitleScraped: "Shop - Example Store",
        websiteMetaDescription: "Online shopping and checkout",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(shoppingPage);

      expect(result).toBe("Product"); // Shopping URLs match Product category patterns
    });

    it("should categorize News/Blog page correctly", () => {
      const newsPage: WebsitePageData = {
        url: "https://example.com/news",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Latest News</h1><p>Read our blog posts</p>",
        textContent: "Latest News Read our blog posts",
        websiteTitleScraped: "News - Example Company",
        websiteMetaDescription: "Latest news and blog posts",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(newsPage);

      expect(result).toBe("Blog"); // The actual category name is "Blog"
    });

    it("should categorize Support page correctly", () => {
      const supportPage: WebsitePageData = {
        url: "https://example.com/support",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Support Center</h1><p>Get help and assistance</p>",
        textContent: "Support Center Get help and assistance",
        websiteTitleScraped: "Support - Example Company",
        websiteMetaDescription: "Customer support and help center",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(supportPage);

      expect(result).toBe("Support");
    });

    it("should categorize Careers page correctly", () => {
      const careersPage: WebsitePageData = {
        url: "https://example.com/careers",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Join Our Team</h1><p>View open positions and apply</p>",
        textContent: "Join Our Team View open positions and apply",
        websiteTitleScraped: "Careers - Example Company",
        websiteMetaDescription: "Career opportunities and job openings",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(careersPage);

      expect(result).toBe("Careers");
    });

    it("should return empty string for unrecognized pages", () => {
      const otherPage: WebsitePageData = {
        url: "https://example.com/xyz123",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Xyz123 Content</h1><p>Some xyz123 text</p>",
        textContent: "Xyz123 Content Some xyz123 text",
        websiteTitleScraped: "Xyz123 Page - Example Organization",
        websiteMetaDescription: "Xyz123 page description",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(otherPage);

      expect(result).toBe(""); // Returns empty string when no category matches
    });

    it("should prioritize URL patterns over content", () => {
      const pageWithConflictingSignals: WebsitePageData = {
        url: "https://example.com/products", // URL suggests Product
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Contact Us</h1><p>Get in touch</p>", // Content suggests Contact
        textContent: "Contact Us Get in touch",
        websiteTitleScraped: "Contact - Example Company",
        websiteMetaDescription: "Contact information",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(pageWithConflictingSignals);

      expect(result).toBe("Product"); // URL pattern should win
    });

    it("should handle pages with multiple category indicators", () => {
      const multiCategoryPage: WebsitePageData = {
        url: "https://example.com/about",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>About Our Products</h1><p>Learn about our company and shop our catalog</p>",
        textContent: "About Our Products Learn about our company and shop our catalog",
        websiteTitleScraped: "About - Example Company",
        websiteMetaDescription: "About our company and products",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(multiCategoryPage);

      expect(result).toBe("About"); // URL pattern should take precedence
    });

    it("should handle case insensitive matching", () => {
      const upperCasePage: WebsitePageData = {
        url: "https://example.com/PRODUCTS",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>OUR PRODUCTS</h1><p>SHOP OUR CATALOG</p>",
        textContent: "OUR PRODUCTS SHOP OUR CATALOG",
        websiteTitleScraped: "PRODUCTS - EXAMPLE COMPANY",
        websiteMetaDescription: "OUR PRODUCT CATALOG",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(upperCasePage);

      expect(result).toBe("Product");
    });

    it("should handle pages with empty content", () => {
      const emptyPage: WebsitePageData = {
        url: "https://example.com/contact",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "",
        textContent: "",
        websiteTitleScraped: "",
        websiteMetaDescription: "",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(emptyPage);

      expect(result).toBe("Contact"); // Should still match URL pattern
    });

    it("should handle pages with special characters in URL", () => {
      const specialCharPage: WebsitePageData = {
        url: "https://example.com/what-we-do",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Our Services</h1><p>What we do for you</p>",
        textContent: "Our Services What we do for you",
        websiteTitleScraped: "Services - Example Company",
        websiteMetaDescription: "Our services and solutions",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(specialCharPage);

      expect(result).toBe("Service");
    });

    it("should handle pages with query parameters in URL", () => {
      const queryParamPage: WebsitePageData = {
        url: "https://example.com/products?category=electronics&sort=price",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>Electronics Products</h1><p>Shop by price</p>",
        textContent: "Electronics Products Shop by price",
        websiteTitleScraped: "Products - Example Store",
        websiteMetaDescription: "Electronics products sorted by price",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(queryParamPage);

      expect(result).toBe("Product");
    });

    it("should handle pages with fragments in URL", () => {
      const fragmentPage: WebsitePageData = {
        url: "https://example.com/about#team",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>About Our Team</h1><p>Meet our team members</p>",
        textContent: "About Our Team Meet our team members",
        websiteTitleScraped: "About - Example Company",
        websiteMetaDescription: "About our team",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(fragmentPage);

      expect(result).toBe("About");
    });
  });

  describe("Edge Cases", () => {
    it("should handle null or undefined input", () => {
      expect(() => WebsitePageCategorizer.getPrimaryCategory(null as any)).toThrow();
      expect(() => WebsitePageCategorizer.getPrimaryCategory(undefined as any)).toThrow();
    });

    it("should handle pages with very long content", () => {
      const longContentPage: WebsitePageData = {
        url: "https://example.com/products",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "a".repeat(10000) + "<h1>Products</h1>" + "b".repeat(10000),
        textContent: "a".repeat(10000) + "Products" + "b".repeat(10000),
        websiteTitleScraped: "Products - Example Company",
        websiteMetaDescription: "Our product catalog",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(longContentPage);

      expect(result).toBe("Product");
    });

    it("should handle pages with HTML entities", () => {
      const htmlEntityPage: WebsitePageData = {
        url: "https://example.com/about",
        index: 1,
        homepageFullPath: "/path/to/screenshot.png",
        homepageFoldPath: "/path/to/screenshot.png",
        htmlContentPath: "/path/to/screenshot.html",
        htmlContent: "<h1>About &amp; Company</h1><p>Our story &amp; mission</p>",
        textContent: "About & Company Our story & mission",
        websiteTitleScraped: "About - Example Company",
        websiteMetaDescription: "About our company",
        success: true,
        errorMessage: "",
        timestamp: "2023-01-01T00:00:00Z"
      };

      const result = WebsitePageCategorizer.getPrimaryCategory(htmlEntityPage);

      expect(result).toBe("About");
    });
  });
});