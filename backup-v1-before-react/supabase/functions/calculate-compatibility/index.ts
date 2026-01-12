import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Récupérer les credentials Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_a, user_b } = await req.json();

    if (!user_a || !user_b) {
      throw new Error('user_a and user_b are required');
    }

    if (user_a === user_b) {
      return new Response(JSON.stringify({
        score: 100,
        common_artists_count: 0,
        common_genres_count: 0,
        message: 'Same user'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Appeler la fonction SQL de calcul de compatibilité
    const { data, error } = await supabase.rpc('calculate_compatibility', {
      user_a_id: user_a,
      user_b_id: user_b
    });

    if (error) {
      console.error('Error calculating compatibility:', error);
      throw error;
    }

    // Le résultat est un tableau avec un seul élément
    const result = data[0] || { score: 0, common_artists_count: 0, common_genres_count: 0 };

    // Ajouter un message contextuel selon le score
    let message = '';
    if (result.score >= 90) {
      message = '💯 Musical Soulmates!';
    } else if (result.score >= 75) {
      message = '🔥 Excellent match!';
    } else if (result.score >= 60) {
      message = '✨ Bonnes vibes ensemble';
    } else if (result.score >= 40) {
      message = '🎵 Quelques goûts communs';
    } else {
      message = '🌍 Univers musicaux différents';
    }

    return new Response(JSON.stringify({
      ...result,
      message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
