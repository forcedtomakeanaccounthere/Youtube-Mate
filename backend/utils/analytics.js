const geoip = require("geoip-lite")

const parseUserAgent = (userAgent) => {
  const ua = userAgent.toLowerCase()

  // Detect device type
  let deviceType = "desktop"
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) {
    deviceType = "mobile"
  } else if (/tablet|ipad/i.test(ua)) {
    deviceType = "tablet"
  }

  // Detect browser
  let browser = "unknown"
  if (ua.includes("chrome") && !ua.includes("edg")) {
    browser = "Chrome"
  } else if (ua.includes("firefox")) {
    browser = "Firefox"
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "Safari"
  } else if (ua.includes("edg")) {
    browser = "Edge"
  } else if (ua.includes("opera") || ua.includes("opr")) {
    browser = "Opera"
  }

  // Detect OS
  let os = "unknown"
  if (ua.includes("windows")) {
    os = "Windows"
  } else if (ua.includes("mac")) {
    os = "macOS"
  } else if (ua.includes("linux")) {
    os = "Linux"
  } else if (ua.includes("android")) {
    os = "Android"
  } else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) {
    os = "iOS"
  }

  return {
    type: deviceType,
    browser,
    os,
  }
}

const getLocationFromIP = (ip) => {
  try {
    // Handle localhost and private IPs
    if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return {
        country: null,
        region: null,
        city: null,
        timezone: null,
      }
    }

    const geo = geoip.lookup(ip)

    if (geo) {
      return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        timezone: geo.timezone,
      }
    }

    return {
      country: null,
      region: null,
      city: null,
      timezone: null,
    }
  } catch (error) {
    console.error("Error getting location from IP:", error)
    return {
      country: null,
      region: null,
      city: null,
      timezone: null,
    }
  }
}

module.exports = {
  parseUserAgent,
  getLocationFromIP,
}