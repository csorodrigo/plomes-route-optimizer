/**
 * Ploomes API Client
 * Official API client for fetching real data from Ploomes CRM
 * Now with integrated rate limiting and error handling
 */

import { rateLimiter } from './ploomes-rate-limiter';

const PLOOMES_BASE_URL = process.env.PLOOMES_BASE_URL || 'https://public-api2.ploomes.com';
const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY || process.env.PLOOME_API_KEY;

if (!PLOOMES_API_KEY) {
  console.error('⚠️ PLOOMES_API_KEY not configured in environment variables');
}

interface PloomesResponse<T> {
  value: T[];
  '@odata.context': string;
  '@odata.count'?: number;
}

interface PloomesContact {
  Id: number;
  Name: string;
  Document: string; // CPF/CNPJ
  Email: string;
  TypeId: number; // 1=Empresa, 2=Pessoa
  StatusId: number;
  StreetAddress?: string;
  CityId?: number;
  OtherProperties?: any[];
}

interface PloomesOrder {
  Id: number;
  Number: number;
  Date: string;
  ContactId: number;
  PersonId?: number;
  Amount: number;
  StageId: number;
  DealId?: number;
  OtherProperties?: any[];
}

interface PloomesProduct {
  Id: number;
  Name: string;
  Code: string;
  Price: number;
  Active: boolean;
  GroupId?: number;
  FamilyId?: number;
  OtherProperties?: any[];
}

interface PloomesDeal {
  Id: number;
  Title: string;
  Amount: number;
  StatusId: number;
  StageId: number;
  PersonId?: number;
  OwnerId?: number;
  CompanyId?: number;
  CreatedDate: string;
  LastInteractionDate?: string;
  Products?: any[];
  OtherProperties?: any[];
}

class PloomesClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = PLOOMES_BASE_URL;
    this.apiKey = PLOOMES_API_KEY || '';
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<PloomesResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'User-Key': this.apiKey,
      'Content-Type': 'application/json; charset=utf-8',
      ...options.headers,
    };

    console.log(`[PLOOMES] → ${endpoint}`);

    // Use rate limiter for all API calls
    const data = await rateLimiter.execute<PloomesResponse<T>>(
      endpoint,
      async () => {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Don't throw here, let rate limiter handle retries
        return response;
      },
      {
        retries: 3,
        backoff: true
      }
    );

    console.log(`[PLOOMES] ✅ ${endpoint} → ${data.value?.length || 0} items`);

    return data;
  }

  /**
   * Paginated fetch helper - automatically handles Ploomes 300-record limit
   * Fetches ALL records by making multiple requests with $skip
   */
  private async getAllPaginated<T>(
    endpoint: string,
    options: {
      select?: string[];
      expand?: string[];
      filter?: string;
    } = {}
  ): Promise<T[]> {
    const allResults: T[] = [];
    const pageSize = 300; // Ploomes API limit
    let skip = 0;
    let hasMore = true;

    console.log(`[PLOOMES PAGINATION] Starting paginated fetch for ${endpoint}`);

    while (hasMore) {
      const params = new URLSearchParams();

      if (options.select?.length) {
        params.append('$select', options.select.join(','));
      }
      if (options.expand?.length) {
        params.append('$expand', options.expand.join(','));
      }
      if (options.filter) {
        params.append('$filter', options.filter);
      }
      params.append('$top', pageSize.toString());
      params.append('$skip', skip.toString());

      const queryString = params.toString();
      const fullEndpoint = `${endpoint}${queryString ? `?${queryString}` : ''}`;

      try {
        const response = await this.request<T>(fullEndpoint);
        const items = response.value || [];

        allResults.push(...items);

        console.log(`[PLOOMES PAGINATION] Fetched ${items.length} items (skip=${skip}, total so far=${allResults.length})`);

        // If we got fewer items than pageSize, we've reached the end
        if (items.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
        }
      } catch (error) {
        console.error(`[PLOOMES PAGINATION] Error at skip=${skip}:`, error);
        hasMore = false;
      }
    }

    console.log(`[PLOOMES PAGINATION] ✅ Complete! Total records: ${allResults.length}`);
    return allResults;
  }

  /**
   * Get all contacts (customers) - AUTO-PAGINATED
   * Automatically fetches ALL contacts by handling pagination
   * $select limits fields to reduce payload
   * $expand gets related data
   */
  async getContacts(options: {
    select?: string[];
    expand?: string[];
    filter?: string;
    top?: number;
    skip?: number;
  } = {}): Promise<PloomesContact[]> {
    // If top/skip specified, use single request (backwards compatibility)
    if (options.top !== undefined || options.skip !== undefined) {
      const params = new URLSearchParams();

      if (options.select?.length) {
        params.append('$select', options.select.join(','));
      }
      if (options.expand?.length) {
        params.append('$expand', options.expand.join(','));
      }
      if (options.filter) {
        params.append('$filter', options.filter);
      }
      if (options.top) {
        params.append('$top', options.top.toString());
      }
      if (options.skip) {
        params.append('$skip', options.skip.toString());
      }

      const queryString = params.toString();
      const endpoint = `/Contacts${queryString ? `?${queryString}` : ''}`;

      const response = await this.request<PloomesContact>(endpoint);
      return response.value;
    }

    // Otherwise, use auto-pagination to get ALL records
    return this.getAllPaginated<PloomesContact>('/Contacts', {
      select: options.select,
      expand: options.expand,
      filter: options.filter,
    });
  }

  /**
   * Get all orders (sales)
   */
  async getOrders(options: {
    select?: string[];
    expand?: string[];
    filter?: string;
    top?: number;
    skip?: number;
  } = {}): Promise<PloomesOrder[]> {
    const params = new URLSearchParams();

    if (options.select?.length) {
      params.append('$select', options.select.join(','));
    }
    if (options.expand?.length) {
      params.append('$expand', options.expand.join(','));
    }
    if (options.filter) {
      params.append('$filter', options.filter);
    }
    if (options.top) {
      params.append('$top', options.top.toString());
    }
    if (options.skip) {
      params.append('$skip', options.skip.toString());
    }

    const queryString = params.toString();
    const endpoint = `/Orders${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<PloomesOrder>(endpoint);
    return response.value;
  }

  /**
   * Get all products
   */
  async getProducts(options: {
    select?: string[];
    filter?: string;
    top?: number;
  } = {}): Promise<PloomesProduct[]> {
    const params = new URLSearchParams();

    if (options.select?.length) {
      params.append('$select', options.select.join(','));
    }
    if (options.filter) {
      params.append('$filter', options.filter);
    }
    if (options.top) {
      params.append('$top', options.top.toString());
    }

    const queryString = params.toString();
    const endpoint = `/Products${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<PloomesProduct>(endpoint);
    return response.value;
  }

  /**
   * Get products from a specific deal
   */
  async getDealProducts(dealId: number): Promise<any[]> {
    try {
      // Tentar primeiro a rota específica de produtos do deal
      const endpoint = `/Deals(${dealId})/DealProducts?$expand=Product($select=Id,Name,Code,Price)`;
      const response = await this.request<any>(endpoint);
      return response.value;
    } catch (error) {
      console.log(`⚠️ Failed to get deal products directly, trying alternative approach`);

      // Fallback: buscar o deal com expand nos produtos
      const dealEndpoint = `/Deals(${dealId})?$expand=DealProducts($expand=Product)`;
      const dealResponse = await this.request<any>(dealEndpoint);
      return dealResponse.DealProducts?.value || [];
    }
  }

  /**
   * Get all deals (opportunities) - AUTO-PAGINATED
   * Automatically fetches ALL deals by handling pagination
   */
  async getDeals(options: {
    select?: string[];
    expand?: string[];
    filter?: string;
    top?: number;
    skip?: number;
    orderby?: string;
  } = {}): Promise<PloomesDeal[]> {
    // If top/skip specified, use single request (backwards compatibility)
    if (options.top !== undefined || options.skip !== undefined) {
      const params = new URLSearchParams();

      if (options.select?.length) {
        params.append('$select', options.select.join(','));
      }
      if (options.expand?.length) {
        params.append('$expand', options.expand.join(','));
      }
      if (options.filter) {
        params.append('$filter', options.filter);
      }
      if (options.top) {
        params.append('$top', options.top.toString());
      }
      if (options.skip) {
        params.append('$skip', options.skip.toString());
      }
      if (options.orderby) {
        params.append('$orderby', options.orderby);
      }

      const queryString = params.toString();
      const endpoint = `/Deals${queryString ? `?${queryString}` : ''}`;

      const response = await this.request<PloomesDeal>(endpoint);
      return response.value;
    }

    // Otherwise, use auto-pagination to get ALL records
    return this.getAllPaginated<PloomesDeal>('/Deals', {
      select: options.select,
      expand: options.expand,
      filter: options.filter,
    });
  }

  /**
   * Get quotes with optional filters
   */
  async getQuotes(options: {
    select?: string[];
    expand?: string[];
    filter?: string;
    top?: number;
    skip?: number;
    orderby?: string;
  } = {}): Promise<any[]> {
    const params = new URLSearchParams();

    if (options.select?.length) {
      params.append('$select', options.select.join(','));
    }
    if (options.expand?.length) {
      params.append('$expand', options.expand.join(','));
    }
    if (options.filter) {
      params.append('$filter', options.filter);
    }
    if (options.top) {
      params.append('$top', options.top.toString());
    }
    if (options.skip) {
      params.append('$skip', options.skip.toString());
    }
    if (options.orderby) {
      params.append('$orderby', options.orderby);
    }

    const queryString = params.toString();
    const endpoint = `/Quotes${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<any>(endpoint);
    return response.value;
  }

  /**
   * Get contact by ID
   */
  async getContactById(id: number): Promise<PloomesContact | null> {
    try {
      const response = await this.request<PloomesContact>(`/Contacts(${id})`);
      return response.value[0] || null;
    } catch (error) {
      console.error(`[PLOOMES] Error fetching contact ${id}:`, error);
      return null;
    }
  }

  /**
   * Load cached deals from JSON file as fallback
   * Now uses the enhanced file with products for better data
   */
  private async loadCachedDeals(): Promise<PloomesDeal[]> {
    try {
      const fs = require('fs');
      const path = require('path');
      // Try the enhanced file with products first
      let cachedDealsPath = path.join(process.cwd(), 'ploomes-deals-with-products.json');

      if (!fs.existsSync(cachedDealsPath)) {
        // Fallback to regular deals file
        cachedDealsPath = path.join(process.cwd(), 'ploomes-deals.json');
      }

      if (fs.existsSync(cachedDealsPath)) {
        const cachedData = fs.readFileSync(cachedDealsPath, 'utf8');
        const deals = JSON.parse(cachedData);
        console.log(`[PLOOMES] Loaded ${deals.length} cached deals from ${path.basename(cachedDealsPath)}`);
        return deals;
      } else {
        console.log(`[PLOOMES] No cached deals file found`);
        return [];
      }
    } catch (error) {
      console.error(`[PLOOMES] Error loading cached deals:`, error);
      return [];
    }
  }

  /**
   * Get deals for a specific contact ID
   * Since Ploomes API doesn't allow filtering by ContactId directly (403 error),
   * we fetch recent deals and filter in memory, with fallback to cached data
   */
  async getDealsForContact(contactId: number, maxResults: number = 10): Promise<PloomesDeal[]> {
    console.log(`[PLOOMES] Getting deals for contact ${contactId}...`);

    try {
      // Try different approaches to find the contact's deals
      const approaches = [
        // Approach 1: Recent deals (most likely to find active customer deals)
        {
          name: 'recent deals',
          options: {
            top: 2000, // Increased from 500 to catch more deals
            orderby: 'CreatedDate desc',
            select: ['Id', 'Title', 'Amount', 'CreatedDate', 'FinishDate', 'StageId', 'ContactId', 'StatusId', 'PersonId', 'OwnerId']
          }
        },
        // Approach 2: Won deals (if customer has closed deals)
        {
          name: 'won deals',
          options: {
            filter: 'StatusId eq 2', // Won deals
            top: 1000, // Increased from 300
            orderby: 'CreatedDate desc',
            select: ['Id', 'Title', 'Amount', 'CreatedDate', 'FinishDate', 'StageId', 'ContactId', 'StatusId', 'PersonId', 'OwnerId']
          }
        }
      ];

      for (const approach of approaches) {
        console.log(`[PLOOMES] Trying approach: ${approach.name}`);

        try {
          const allDeals = await this.getDeals(approach.options);
          const contactDeals = allDeals
            .filter(deal => deal.ContactId === contactId)
            .slice(0, maxResults);

          console.log(`[PLOOMES] Found ${contactDeals.length} deals for contact using ${approach.name}`);

          if (contactDeals.length > 0) {
            return contactDeals;
          }
        } catch (approachError) {
          console.log(`[PLOOMES] Approach ${approach.name} failed:`, approachError);

          // If API returns 403, try cached data
          if (approachError instanceof Error && approachError.message.includes('403')) {
            console.log(`[PLOOMES] API returned 403, trying cached deals...`);
            const cachedDeals = await this.loadCachedDeals();
            const contactDeals = cachedDeals
              .filter((deal: any) => deal.ContactId === contactId)
              .slice(0, maxResults)
              .map((deal: any) => ({
                Id: deal.Id,
                Title: deal.Title,
                Amount: deal.Amount,
                StatusId: deal.StatusId,
                StageId: deal.StageId,
                ContactId: deal.ContactId,
                PersonId: deal.PersonId,
                OwnerId: deal.OwnerId,
                CreatedDate: deal.LastUpdateDate, // Use LastUpdateDate as CreatedDate for cached data
                FinishDate: null,
                Products: deal.Products || []
              }));

            if (contactDeals.length > 0) {
              console.log(`[PLOOMES] Found ${contactDeals.length} deals from cached data`);
              return contactDeals;
            }
          }
          continue;
        }
      }

      // If all API approaches failed, try cached data as final fallback
      console.log(`[PLOOMES] All API approaches failed, trying cached data as final fallback...`);
      const cachedDeals = await this.loadCachedDeals();
      const contactDeals = cachedDeals
        .filter((deal: any) => deal.ContactId === contactId)
        .slice(0, maxResults)
        .map((deal: any) => ({
          Id: deal.Id,
          Title: deal.Title,
          Amount: deal.Amount,
          StatusId: deal.StatusId,
          StageId: deal.StageId,
          ContactId: deal.ContactId,
          PersonId: deal.PersonId,
          OwnerId: deal.OwnerId,
          CreatedDate: deal.LastUpdateDate,
          FinishDate: null,
          Products: deal.Products || []
        }));

      if (contactDeals.length > 0) {
        console.log(`[PLOOMES] Found ${contactDeals.length} deals from cached data (fallback)`);
        return contactDeals;
      }

      console.log(`[PLOOMES] No deals found for contact ${contactId} using any approach including cached data`);
      return [];

    } catch (error) {
      console.error(`[PLOOMES] Error getting deals for contact ${contactId}:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const ploomesClient = new PloomesClient();

// Export types
export type {
  PloomesContact,
  PloomesOrder,
  PloomesProduct,
  PloomesDeal,
  PloomesResponse,
};
