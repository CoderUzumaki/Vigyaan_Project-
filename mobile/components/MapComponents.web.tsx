import React from 'react';
import { View, StyleSheet } from 'react-native';

export const MapView = ({ children, style, initialRegion, region }: any) => {
  const targetRegion = region || initialRegion;
  const lat = targetRegion?.latitude || 28.6139;
  const lng = targetRegion?.longitude || 77.2090;
  
  // Use Google Maps with satellite view (t=k)
  const iframeSrc = `https://www.google.com/maps?q=${lat},${lng}&t=k&z=15&output=embed`;

  return (
    <View style={[styles.container, style]}>
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0 }}
        src={iframeSrc}
        title="Web Map View"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0a0e1a',
  },
});

export const Polygon = () => null;
export const Marker = () => null;
export const Circle = () => null;
export const PROVIDER_GOOGLE = 'google';

export default MapView;
