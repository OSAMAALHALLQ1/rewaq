import { NextResponse } from "next/server";
import { createAdminClientWithContext } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/social/oauth/callback`;
  
  if (!state) {
    return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=missing_state`);
  }
  
  try {
    const admin = createAdminClientWithContext("social/oauth/callback");
    
    // 1. Verify and consume state
    const { data: oauthState, error: stateQueryError } = await admin
      .from("social_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();
      
    if (stateQueryError || !oauthState) {
      console.error("State query error or state not found:", stateQueryError);
      return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=invalid_state`);
    }
    
    // Verify expiry
    if (new Date(oauthState.expires_at) < new Date()) {
      return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=expired_state`);
    }
    
    // Consume the state
    await admin
      .from("social_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", oauthState.id);
      
    const organizationId = oauthState.organization_id;
    const userId = oauthState.created_by;
    
    // 2. Obtain Pages and Instagram Accounts (Real Meta OAuth or Developer Mock)
    let pagesToConnect: Array<{
      id: string;
      name: string;
      accessToken: string;
      instagramBusinessAccount?: {
        id: string;
        username: string;
        name: string;
      };
    }> = [];
    
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
    const isMockMode = !clientId || !clientSecret || code === "mock";
    
    if (isMockMode) {
      console.log("Meta credentials not fully set. Running in Developer Mock Mode.");
      // Simulated delay for Meta APIs
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      pagesToConnect = [
        {
          id: "326930381234987", // matches the FACEBOOK_PAGE_ID in .env for seamless testing
          name: "رواق - الصفحة الرئيسية",
          accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "mock_page_access_token_1",
          instagramBusinessAccount: {
            id: "17841404135598654", // matches INSTAGRAM_BUSINESS_ACCOUNT_ID in .env
            username: "rawaq.restaurant",
            name: "مطعم رواق - Rawaq"
          }
        },
        {
          id: "fb_page_id_gaza",
          name: "رواق - فرع غزة",
          accessToken: "mock_page_access_token_2",
          instagramBusinessAccount: {
            id: "ig_account_id_gaza",
            username: "rawaq.gaza",
            name: "رواق غزة"
          }
        },
        {
          id: "fb_page_id_cafe",
          name: "رواق كافيه Rawaq Cafe",
          accessToken: "mock_page_access_token_3"
        }
      ];
    } else {
      // REAL META OAUTH FLOW
      if (!code) {
        return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=missing_code`);
      }
      
      // A. Exchange code for User Access Token
      const tokenExchangeRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`
      );
      
      const tokenData = await tokenExchangeRes.json();
      if (!tokenExchangeRes.ok || tokenData.error) {
        console.error("Meta Token Exchange Error:", tokenData.error);
        return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=token_exchange_failed`);
      }
      
      const shortLivedUserToken = tokenData.access_token;
      
      // B. Exchange User Access Token for Long-Lived User Access Token
      const longLivedExchangeRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortLivedUserToken}`
      );
      
      const longLivedData = await longLivedExchangeRes.json();
      if (!longLivedExchangeRes.ok || longLivedData.error) {
        console.error("Meta Long-Lived Token Exchange Error:", longLivedData.error);
        return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=long_lived_failed`);
      }
      
      const longLivedUserToken = longLivedData.access_token;
      
      // C. Get Facebook Pages managed by user
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedUserToken}`
      );
      
      const pagesData = await pagesRes.json();
      if (!pagesRes.ok || pagesData.error) {
        console.error("Meta Fetch Pages Error:", pagesData.error);
        return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=fetch_pages_failed`);
      }
      
      const rawPages = pagesData.data || [];
      
      // D. For each page, query connected Instagram Business Account
      for (const page of rawPages) {
        const pageId = page.id;
        const pageAccessToken = page.access_token;
        const pageName = page.name;
        
        let instagramAccount = undefined;
        
        try {
          const igRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
          );
          const igData = await igRes.json();
          
          if (igRes.ok && igData.instagram_business_account) {
            const igId = igData.instagram_business_account.id;
            
            // Fetch Instagram Account details (username, name)
            const igDetailsRes = await fetch(
              `https://graph.facebook.com/v21.0/${igId}?fields=username,name&access_token=${pageAccessToken}`
            );
            const igDetailsData = await igDetailsRes.json();
            
            if (igDetailsRes.ok) {
              instagramAccount = {
                id: igId,
                username: igDetailsData.username || `ig_${igId}`,
                name: igDetailsData.name || igDetailsData.username || "Instagram Account"
              };
            }
          }
        } catch (igError) {
          console.error(`Failed to fetch Instagram account for Page ${pageId}:`, igError);
        }
        
        pagesToConnect.push({
          id: pageId,
          name: pageName,
          accessToken: pageAccessToken,
          instagramBusinessAccount: instagramAccount
        });
      }
    }
    
    if (pagesToConnect.length === 0) {
      return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=no_pages_found`);
    }
    
    // Determine connection status:
    // If only 1 page is found, we activate it automatically.
    // If multiple pages are found, we save them as 'disabled' and let the user select.
    const autoActivate = pagesToConnect.length === 1;
    
    // Save pages and IG accounts to the database
    for (const page of pagesToConnect) {
      // 1. Delete existing account for this page/organization to avoid duplicates
      await admin
        .from("social_accounts")
        .delete()
        .eq("organization_id", organizationId)
        .eq("platform", "facebook")
        .eq("external_account_id", page.id);
        
      // 2. Insert Facebook account
      const encryptedPageToken = encrypt(page.accessToken);
      const fbStatus = autoActivate ? "connected" : "disabled";
      
      const { error: fbInsertError } = await admin
        .from("social_accounts")
        .insert({
          organization_id: organizationId,
          platform: "facebook",
          account_name: page.name,
          external_account_id: page.id,
          encrypted_access_token: encryptedPageToken,
          status: fbStatus,
          created_by: userId
        });
        
      if (fbInsertError) {
        console.error("Failed to insert FB account:", fbInsertError);
      }
      
      // 3. Insert Instagram account if connected
      if (page.instagramBusinessAccount) {
        await admin
          .from("social_accounts")
          .delete()
          .eq("organization_id", organizationId)
          .eq("platform", "instagram")
          .eq("external_account_id", page.instagramBusinessAccount.id);
          
        const { error: igInsertError } = await admin
          .from("social_accounts")
          .insert({
            organization_id: organizationId,
            platform: "instagram",
            account_name: `${page.instagramBusinessAccount.name} (@${page.instagramBusinessAccount.username})`,
            external_account_id: page.instagramBusinessAccount.id,
            encrypted_access_token: encryptedPageToken, // Instagram publishing uses the linked Facebook Page Access Token
            status: fbStatus, // Sync status with the FB page
            created_by: userId,
            metadata: {
              facebook_page_id: page.id,
              username: page.instagramBusinessAccount.username
            }
          });
          
        if (igInsertError) {
          console.error("Failed to insert IG account:", igInsertError);
        }
      }
    }
    
    // Redirect logic:
    if (autoActivate) {
      return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?success=oauth_connected`);
    } else {
      // Direct user to select a page
      return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?select_platform=facebook`);
    }
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=oauth_callback_failed`);
  }
}
