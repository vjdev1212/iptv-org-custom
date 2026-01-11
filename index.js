// Skip @HD and @SD
const CHANNEL_CONFIG = {
  "Tamil": {
    "Kids": [
      'ChuttiTV.in',
    ],
    "Movies": [
      'JMovie.in',
      'SunLife.in',
      'RajDigitalPlus.in',
      'KTV.in',
      'SuriyanTV.in',
      'AnandhamTV.in',
      'RojaMovies.in'
    ],
    "News": [
      'News18TamilNadu.in',
      'PolimerNews.in',
      'News7Tamil.in',
      'SunNews.in',
      'PuthiyaThalaimurai.in',
      'ThanthiTV.in',
      'MadhimugamTV.in',
      'WinTV.in',
      'NewsJ.in',
      'NewsTamil24x7.in',
      'Velicham.in',
      'TamilJanam.in'
    ],
    "Entertainment": [
      'JayaTV.in',
      'ColorsTamil.in',
      'PolimerTV.in',
      'RajTV.in',
      'MakkalTV.in',
      'AdithyaTV.in',
      'PeppersTV.in',
      'VendharTV.in',
      'SunTV.in',
      'VaanavilTV.in',
      'KalaignarTV.in',
      'MoonTV.in',
      'MKSix.in',
      'SanaTV.in',
      'SubinTV.in',
      'BrioTV.in',
      'NTCTV.in',
      'SuriyaTV.in',
      'RojaTV.in'
    ],
    "Music": [
      'RajMusixTamil.in',
      'Tunes6.in',
      'SunMusic.in',
      'SanaPlus.in',
      'AaryaaTV.in',
      'UltimateTV.in'
    ],
    "Infotainment": [
      'HistoryTV18.in'
    ],
    "Devotional": [
      'AngelTV.in',
      'SaiTV.in',
      'MadhaTV.in',
      'SVBC.in',
      'SVBC3.in',
      'SVBC4.in',
      'OMTV.in'
    ],
    "Lifestyle": [
      'Travelxp.in'
    ],
    "Sports": [
      'SonySportsTen2.in'
    ],
    "Shopping": []
  },
  "Hindi": {
    "News": [],
    "Music": [],
    "Entertainment": []
  },
  "Telugu": {
    "News": [],
    "Entertainment": []
  }
};

const IPTV_SOURCE_URL = 'https://raw.githubusercontent.com/iptv-org/iptv/refs/heads/master/streams/in.m3u';

// ============================================

function parseM3U(content) {
  const lines = content.split('\n');
  const channels = [];
  const seen = new Map(); // Track tvg-id to avoid duplicates
  let currentChannel = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
      const nameMatch = line.match(/,(.+)$/);
      const tvgId = tvgIdMatch ? tvgIdMatch[1] : '';
      
      currentChannel = {
        tvgId: tvgId,
        name: nameMatch ? nameMatch[1].trim() : ''
      };
    } else if (line && !line.startsWith('#') && currentChannel) {
      currentChannel.url = line;
      
      // Only add first occurrence of each tvg-id
      if (!seen.has(currentChannel.tvgId)) {
        channels.push(currentChannel);
        seen.set(currentChannel.tvgId, true);
      }
      currentChannel = null;
    }
  }
  
  return channels;
}

function generateTvgId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanChannelName(name) {
  // Remove HD, SD, @HD, @SD and country codes, and extra spaces
  return name
    .replace(/@(HD|SD)/gi, '')
    .replace(/\s+(HD|SD)\+?/gi, '')
    .replace(/\s+\([^)]+\)/g, '') // Remove parenthetical info
    .replace(/\s+\[[^\]]+\]/g, '') // Remove bracketed info
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAndEnhanceChannels(channels, config) {
  const enhanced = [];
  const matched = new Set(); // Track which tvg-ids we've already matched
  
  // Flatten the nested config structure
  for (const [language, groups] of Object.entries(config)) {
    for (const [groupTitle, tvgIds] of Object.entries(groups)) {
      for (const tvgId of tvgIds) {
        // Skip if we've already matched this tvg-id
        if (matched.has(tvgId)) {
          continue;
        }
        
        // Find matching channel from source by tvg-id (only first match)
        const matchedChannel = channels.find(ch => ch.tvgId === tvgId);
        
        if (matchedChannel) {
          const cleanName = cleanChannelName(matchedChannel.name);
          enhanced.push({
            tvgId: tvgId,
            tvgName: cleanName,
            tvgLanguage: language,
            tvgType: groupTitle,
            groupTitle: groupTitle,
            url: matchedChannel.url,
            originalName: matchedChannel.name
          });
          matched.add(tvgId);
        }
      }
    }
  }
  
  return enhanced;
}

function sortChannels(channels) {
  return channels.sort((a, b) => {
    // Primary sort: language
    if (a.tvgLanguage !== b.tvgLanguage) {
      return a.tvgLanguage.localeCompare(b.tvgLanguage);
    }
    // Secondary sort: group
    if (a.groupTitle !== b.groupTitle) {
      return a.groupTitle.localeCompare(b.groupTitle);
    }
    // Tertiary sort: name
    return a.tvgName.localeCompare(b.tvgName);
  });
}

function channelsToM3U(channels) {
  let m3u = '#EXTM3U\n';
  
  for (const ch of channels) {
    const extinf = `#EXTINF:-1 tvg-id="${ch.tvgId}" tvg-name="${ch.tvgName}" tvg-language="${ch.tvgLanguage}" tvg-type="${ch.tvgType}" group-title="${ch.groupTitle}",${ch.tvgName}`;
    m3u += `${extinf}\n${ch.url}\n`;
  }
  
  return m3u;
}

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Fetch the source M3U
      const response = await fetch(IPTV_SOURCE_URL);
      const content = await response.text();
      
      // Parse, match with config, and sort
      let allChannels = parseM3U(content);
      let matchedChannels = matchAndEnhanceChannels(allChannels, CHANNEL_CONFIG);
      let sortedChannels = sortChannels(matchedChannels);
          
      // Generate enhanced M3U
      const enhancedM3U = channelsToM3U(sortedChannels);
      
      return new Response(enhancedM3U, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Disposition': 'attachment; filename="playlist.m3u"',
          ...corsHeaders
        }
      });
      
    } catch (error) {
      return new Response(`Error: ${error.message}`, { 
        status: 500,
        headers: corsHeaders
      });
    }
  }
};