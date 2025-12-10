import { corsHeaders } from "../../_shared/standardImports.ts";

export interface PerformanceMetadata {
  requestId: string;
  totalDuration: number;
  cacheHit: boolean;
  searchActive: boolean;
  dataEnrichment?: {
    profilesEnriched: number;
    authDataAvailable: number;
    subscriptionsAvailable: number;
  };
}

export interface PaginatedResponse {
  users: any[];
  total: number;
  totalUsers: number;
  page: number;
  limit: number;
  totalPages: number;
  performance: PerformanceMetadata;
}

/**
 * Build successful paginated response
 */
export function buildSuccessResponse(
  users: any[],
  total: number,
  page: number,
  limit: number,
  performance: PerformanceMetadata
): Response {
  const totalPages = Math.ceil(total / limit);
  
  const responseData: PaginatedResponse = {
    users,
    total,
    totalUsers: total,
    page,
    limit,
    totalPages,
    performance
  };
  
  return new Response(
    JSON.stringify(responseData),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Build empty results response
 */
export function buildEmptyResponse(
  total: number,
  page: number,
  limit: number,
  requestId: string,
  totalDuration: number,
  search: string
): Response {
  return new Response(
    JSON.stringify({
      users: [],
      total,
      totalUsers: total,
      page,
      limit,
      totalPages: 0,
      performance: {
        requestId,
        totalDuration,
        cacheHit: false,
        searchActive: !!search
      }
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Build error response for pagination issues
 */
export function buildPaginationErrorResponse(
  message: string,
  page: number,
  totalPages: number,
  total: number
): Response {
  return new Response(
    JSON.stringify({ 
      error: message,
      redirect: { page: Math.max(1, totalPages), totalPages },
      total,
      totalUsers: total
    }), 
    { 
      status: 416,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Build validation error response
 */
export function buildValidationErrorResponse(message: string, details?: any): Response {
  return new Response(
    JSON.stringify({ 
      error: message,
      details
    }), 
    { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Build internal error response
 */
export function buildErrorResponse(
  error: string,
  requestId: string,
  duration: number
): Response {
  return new Response(
    JSON.stringify({
      error: 'Failed to fetch users',
      message: error || 'Unknown error occurred',
      requestId,
      timestamp: new Date().toISOString(),
      duration
    }), 
    { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
