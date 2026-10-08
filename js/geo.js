/* ============================================================
   邻居好物 - 地理模块
   同城市 / 同区域 / 同街道 / 同小区 四级筛选 + 距离计算
   定位机制：用户选择所在地（小区级），发布商品时选择商品所在地（小区级）。
   距离计算采用 Haversine 公式（单位：米）。
   注意：本位置库为示例行政区划数据，正式上线前请按当地行政区划校准替换。
   ============================================================ */
(function (global) {
  'use strict';

  // 位置库：城市 -> 区（县） -> 街道 -> 所在小区（含经纬度，小区级坐标沿用街道中心）
  // 默认位置：武汉市 / 东西湖区 / 常青花园街道 / 常青花园一社区（新用户与发布商品默认）
  var LOCATIONS = [
    {
      city: '武汉市',
      districts: [
        {
          district: '东西湖区',
          center: [114.2300, 30.6500],
          streets: [
            { street: '常青花园街道', lng: 114.2300, lat: 30.6500, communities: ['常青花园一社区', '常青花园二社区', '常青花园三社区', '常青花园四社区'] },
            { street: '金银湖街道', lng: 114.1900, lat: 30.6300, communities: ['金银湖一社区', '金银湖二社区', '金银湖三社区'] },
            { street: '吴家山街道', lng: 114.1300, lat: 30.6300, communities: ['吴家山一社区', '吴家山二社区', '吴家山三社区'] },
            { street: '径河街道', lng: 114.1800, lat: 30.6800, communities: ['径河一社区', '径河二社区'] }
          ]
        },
        {
          district: '江汉区',
          center: [114.2680, 30.6010],
          streets: [
            { street: '万松街道', lng: 114.2650, lat: 30.5980, communities: ['万松一社区', '万松二社区', '万松三社区'] },
            { street: '汉兴街道', lng: 114.2500, lat: 30.6200, communities: ['汉兴一社区', '汉兴二社区'] }
          ]
        },
        {
          district: '江岸区',
          center: [114.3090, 30.6000],
          streets: [
            { street: '后湖街道', lng: 114.2900, lat: 30.6300, communities: ['后湖一社区', '后湖二社区', '后湖三社区'] },
            { street: '塔子湖街道', lng: 114.2800, lat: 30.6400, communities: ['塔子湖一社区', '塔子湖二社区'] }
          ]
        }
      ]
    },
    {
      city: '重庆市',
      districts: [
        {
          district: '渝中区',
          center: [106.5639, 29.5530],
          streets: [
            { street: '解放碑街道', lng: 106.5833, lat: 29.5569, communities: ['解放碑一社区', '解放碑二社区', '解放碑三社区'] },
            { street: '朝天门街道', lng: 106.5886, lat: 29.5650, communities: ['朝天门一社区', '朝天门二社区'] },
            { street: '七星岗街道', lng: 106.5699, lat: 29.5583, communities: ['七星岗一社区', '七星岗二社区'] },
            { street: '大坪街道',   lng: 106.5301, lat: 29.5409, communities: ['大坪一社区', '大坪二社区', '大坪三社区'] },
            { street: '上清寺街道', lng: 106.5561, lat: 29.5620, communities: ['上清寺一社区', '上清寺二社区'] },
            { street: '化龙桥街道', lng: 106.5200, lat: 29.5520, communities: ['化龙桥一社区', '化龙桥二社区'] }
          ]
        },
        {
          district: '江北区',
          center: [106.5788, 29.6069],
          streets: [
            { street: '观音桥街道', lng: 106.5367, lat: 29.5855, communities: ['观音桥一社区', '观音桥二社区', '观音桥三社区'] },
            { street: '石马河街道', lng: 106.5220, lat: 29.5980, communities: ['石马河一社区', '石马河二社区'] },
            { street: '华新街街道', lng: 106.5440, lat: 29.5740, communities: ['华新街一社区', '华新街二社区'] },
            { street: '五里店街道', lng: 106.5660, lat: 29.5880, communities: ['五里店一社区', '五里店二社区'] }
          ]
        },
        {
          district: '南岸区',
          center: [106.6444, 29.4868],
          streets: [
            { street: '南坪街道', lng: 106.5740, lat: 29.5280, communities: ['南坪一社区', '南坪二社区', '南坪三社区'] },
            { street: '弹子石街道', lng: 106.6100, lat: 29.5560, communities: ['弹子石一社区', '弹子石二社区'] },
            { street: '龙门浩街道', lng: 106.5940, lat: 29.5410, communities: ['龙门浩一社区', '龙门浩二社区'] }
          ]
        }
      ]
    },
    {
      city: '成都市',
      districts: [
        {
          district: '武侯区',
          center: [104.0515, 30.6407],
          streets: [
            { street: '玉林街道', lng: 104.0580, lat: 30.6330, communities: ['玉林一社区', '玉林二社区', '玉林三社区'] },
            { street: '桂溪街道', lng: 104.0760, lat: 30.6120, communities: ['桂溪一社区', '桂溪二社区'] },
            { street: '火车南站街道', lng: 104.0720, lat: 30.6280, communities: ['火车南站一社区', '火车南站二社区'] },
            { street: '簇桥街道', lng: 104.0110, lat: 30.6110, communities: ['簇桥一社区', '簇桥二社区', '簇桥三社区'] }
          ]
        },
        {
          district: '锦江区',
          center: [104.0878, 30.6241],
          streets: [
            { street: '春熙路街道', lng: 104.0810, lat: 30.6540, communities: ['春熙路一社区', '春熙路二社区'] },
            { street: '书院街街道', lng: 104.0920, lat: 30.6590, communities: ['书院街一社区', '书院街二社区'] },
            { street: '柳江街道', lng: 104.1200, lat: 30.6150, communities: ['柳江一社区', '柳江二社区'] }
          ]
        }
      ]
    }
  ];

  function deg2rad(deg) { return deg * Math.PI / 180; }

  // 计算两坐标间的距离（米）
  function distance(lng1, lat1, lng2, lat2) {
    var R = 6371000;
    var dLat = deg2rad(lat2 - lat1);
    var dLng = deg2rad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // 距离展示格式化：<1km 以米显示，否则 .1km
  function fmtDist(m) {
    if (m < 1000) return Math.round(m) + 'm';
    return (m / 1000).toFixed(1) + 'km';
  }

  // 查找街道对象（含小区列表）
  function findStreetObj(cityName, districtName, streetName) {
    for (var i = 0; i < LOCATIONS.length; i++) {
      if (LOCATIONS[i].city !== cityName) continue;
      var city = LOCATIONS[i];
      for (var j = 0; j < city.districts.length; j++) {
        if (city.districts[j].district !== districtName) continue;
        var district = city.districts[j];
        for (var k = 0; k < district.streets.length; k++) {
          if (district.streets[k].street === streetName) return district.streets[k];
        }
      }
    }
    return null;
  }

  // 查找街道（返回带 city/district/community 的完整位置对象；小区缺省取该街道第一个小区）
  function findStreet(cityName, districtName, streetName) {
    var st = findStreetObj(cityName, districtName, streetName);
    if (!st) return null;
    return {
      city: cityName, district: districtName, street: st.street,
      community: (st.communities && st.communities[0]) || '',
      lng: st.lng, lat: st.lat
    };
  }

  // 查找"所在小区"（四级定位）；小区名不匹配时回退街道第一个小区
  function findPlace(cityName, districtName, streetName, communityName) {
    var st = findStreetObj(cityName, districtName, streetName);
    if (!st) return null;
    var matched = communityName && st.communities && st.communities.indexOf(communityName) >= 0 ? communityName : ((st.communities && st.communities[0]) || '');
    return {
      city: cityName, district: districtName, street: st.street,
      community: matched, lng: st.lng, lat: st.lat
    };
  }

  // 位置规范化：旧数据可能缺 community，此处统一补齐（找不到则保留原值并加空社区）
  function normalize(pos) {
    if (!pos || !pos.city || !pos.district || !pos.street) return pos;
    if (pos.community) return pos;
    var p = findPlace(pos.city, pos.district, pos.street, '');
    if (p) { pos.community = p.community; pos.lng = p.lng; pos.lat = p.lat; }
    return pos;
  }

  // 判断两个位置是否同城 / 同区域 / 同街道 / 同小区
  // pos: {city, district, street, community}
  function sameScope(a, b, scope) {
    if (!a || !b) return false;
    if (a.city !== b.city) return false;
    if (scope === 'city') return true;
    if (a.district !== b.district) return false;
    if (scope === 'district') return true;
    if (a.street !== b.street) return false;
    if (scope === 'street') return true;
    if (scope === 'community') {
      // 双方均有小区时按小区严格匹配；缺少小区信息时视同街道内（兼容旧数据）
      if (a.community && b.community) return a.community === b.community;
      return true;
    }
    return true;
  }

  // 从位置库取默认位置（第一个城市第一个街道第一个小区）
  function defaultLocation() {
    var c = LOCATIONS[0], d = c.districts[0], s = d.streets[0];
    return findPlace(c.city, d.district, s.street, (s.communities && s.communities[0]) || '');
  }

  var Geo = {
    LOCATIONS: LOCATIONS,
    distance: distance,
    fmtDist: fmtDist,
    findStreetObj: findStreetObj,
    findStreet: findStreet,
    findPlace: findPlace,
    normalize: normalize,
    sameScope: sameScope,
    defaultLocation: defaultLocation
  };

  global.SQYP_GEO = Geo;
})(window);