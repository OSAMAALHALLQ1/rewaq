/**
 * Mock Supabase modules for testing
 */

export const createClient = () => ({
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    getClaims: async () => ({ data: { claims: null }, error: null }),
    signInWithPassword: async () => ({ data: null, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }),
});

export const createServerClient = createClient;

export const createAdminClient = () => ({
  auth: {
    admin: {
      listUsers: async () => ({ data: { users: [] }, error: null }),
      updateUserById: async () => ({ error: null }),
    },
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: null }),
      }),
    }),
    update: () => ({
      eq: () => ({ data: null, error: null }),
    }),
  }),
});

export const createAdminClientWithContext = createAdminClient;

export const hasSupabaseEnv = () => false;
export const hasSupabaseAdminEnv = () => false;
