const CHANNEL_CONFIG = {
  "Tamil": {
    "Kids": [
      'Chutti TV',
    ],
    "Movies": [
      'J Movie',
      'Sun Life',
      'Raj Digital Plus',
      'KTV',
      'Suriyan TV',
      'Anandham TV',
      'Roja Movies'
    ],
    "News": [
      'News18 Tamil Nadu',
      'Polimer News',
      'News 7 Tamil',
      'Sun News',
      'Puthiya Thalaimurai',
      'Thanthi TV',
      'Madhimugam TV',
      'Win TV',
      'News J',
      'News Tamil 24x7',
      'Velicham',
      'Tamil Janam'
    ],
    "Entertainment": [
      'Jaya TV',
      'Colors Tamil HD',
      'Polimer TV',
      'Raj TV',
      'Makkal TV',
      'Adithya TV',
      'Peppers TV',
      'Vendhar TV',
      'Sun TV',
      'Vaanavil TV',
      'Kalaignar TV',
      'Moon TV',
      'MK Six',
      'Sana TV',
      'Subin TV',
      'Brio TV',
      'NTC TV',
      'Suriya TV',
      'Roja TV'
    ],
    "Music": [
      'Raj Musix Tamil',
      'Tunes 6',
      'Sun Music',
      'Sana Plus',
      'Aaryaa TV',
      'Ultimate TV'
    ],
    "Infotainment": [
      'History TV18 HD'
    ],
    "Devotional": [
      'Angel TV',
      'Sai TV',
      'Madha TV',
      'SVBC',
      'SVBC 3',
      'SVBC 4',
      'OM TV'
    ],
    "Lifestyle": [
      'Travelxp'
    ],
    "Sports": [
      'Sony Sports Ten 2'
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
        originalTvgId: tvgId,
        originalName: nameMatch ? nameMatch[1].trim() : ''
      };
    } else if (line && !line.startsWith('#') && currentChannel) {
      currentChannel.url = line;
      
      // Only add first occurrence of each tvg-id
      if (!seen.has(currentChannel.originalTvgId)) {
        channels.push(currentChannel);
        seen.set(currentChannel.originalTvgId, true);
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
  // Remove HD, SD, and extra spaces
  return name.replace(/\s+(HD|SD)\+?/gi, '').replace(/\s+/g, ' ').trim();
}

function matchAndEnhanceChannels(channels, config) {
  const enhanced = [];
  const matched = new Set(); // Track which channels we've already matched
  
  // Flatten the nested config structure
  for (const [language, groups] of Object.entries(config)) {
    for (const [groupTitle, channelNames] of Object.entries(groups)) {
      for (const channelName of channelNames) {
        // Skip if we've already matched this channel
        if (matched.has(channelName.toLowerCase())) {
          continue;
        }
        
        // Find matching channel from source (only first match)
        const matchedChannel = channels.find(ch => {
          const searchText = `${ch.originalName} ${ch.originalTvgId}`.toLowerCase();
          return searchText.includes(channelName.toLowerCase());
        });
        
        if (matchedChannel) {
          const cleanName = cleanChannelName(channelName);
          enhanced.push({
            tvgId: generateTvgId(cleanName),
            tvgName: cleanName,
            tvgLanguage: language,
            tvgType: groupTitle,
            groupTitle: groupTitle,
            url: matchedChannel.url,
            originalName: matchedChannel.originalName
          });
          matched.add(channelName.toLowerCase());
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
    const extinf = `#EXTINF:-1 tvg-id="${ch.tvgId}" tvg-name="${ch.tvgName}" tvg-language="${ch.tvgLanguage}" tvg-type="${ch.tvgType}" group-title="${ch.groupTitle}", ${ch.tvgName}`;
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
      const enhancedM3U = debugInfo + channelsToM3U(sortedChannels);
      
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