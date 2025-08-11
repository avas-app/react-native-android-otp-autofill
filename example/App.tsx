import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

import { Hooks } from './screens/Hooks'
import { Manual } from './screens/Manual'
import { StatusBar } from 'expo-status-bar'
import { styles } from './styles'

type TabType = 'hooks' | 'manual'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('hooks')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hooks':
        return <Hooks />
      case 'manual':
        return <Manual />
      default:
        return <Hooks />
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Simple Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'hooks' && styles.activeTab
          ]}
          onPress={() => setActiveTab('hooks')}
        >
          <Text style={[
            styles.tabButtonText,
            activeTab === 'hooks' && styles.activeTabText
          ]}>
            Hook 
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'manual' && styles.activeTab
          ]}
          onPress={() => setActiveTab('manual')}
        >
          <Text style={[
            styles.tabButtonText,
            activeTab === 'manual' && styles.activeTabText
          ]}>
            Manual 
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {renderTabContent()}
      </View>
    </View>
  )
}