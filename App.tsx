import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Dimensions } from 'react-native';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function App() {
  
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef(null);
  const ws = useRef(null);
  const [detections, setDetections] = useState([]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  useEffect(() => {
    ws.current = new WebSocket('ws://192.168.78.9:8000/detect-websocket');

    ws.current.onopen = () => console.log('WebSocket connected');
    ws.current.onmessage = (e) => {
      try {
        const json = JSON.parse(e.data);
        setDetections(json.detections || []);
      } catch (err) {
        console.error('Failed to parse detection JSON:', err);
      }
    };
    ws.current.onerror = (e) => console.error(e.message);
    ws.current.onclose = () => console.log('WebSocket closed');

    return () => ws.current?.close();
  }, []);

  const captureAndSend = async () => {
    if (cameraRef.current && ws.current.readyState === WebSocket.OPEN) {
      const photo = await cameraRef.current.takePhoto({ quality: 50, skipMetadata: true });
      const response = await fetch(`file://${photo.path}`);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(',')[1];
        ws.current.send(base64data);
      };
      reader.readAsDataURL(blob);
    }
  };

  useEffect(() => {
    const intervalId = setInterval(captureAndSend, 100);
    return () => clearInterval(intervalId);
  }, []);

  if (!hasPermission || !device) return <Text>Loading camera...</Text>;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />
      {detections.map((d, i) => {
        
        console.log("screenWidth: " + screenWidth);
        console.log("screenHeight: " + screenHeight);
        const [x1, y1, x2, y2] = d.bounding_box;
        const left = x1 * screenWidth;
        const top = y1 * screenHeight;
        const boxWidth = (x2 - x1) * screenWidth;
        const boxHeight = (y2 - y1) * screenHeight;

        console.log(left,top,boxWidth,boxHeight);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left,
              top,
              width: boxWidth,
              height: boxHeight,
              borderColor: 'lime',
              borderWidth: 2,
            }}
            
            >
            <Text style={{ color: 'white', backgroundColor: 'black', fontSize: 10 }}>
              {d.class_name} ({Math.round(d.confidence * 100)}%)
            </Text>
          </View>
        );
      })}
    </View>
  );
}
