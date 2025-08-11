import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  hashContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  hashText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
  },
  copyHint: {
    fontSize: 10,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  helpText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 10,
  },
  hashButtonContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1976d2',
  },
  resultContainer: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorContainer: {
    backgroundColor: '#ffeaea',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d32f2f',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#2e7d32',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
  },
  clearButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#495057',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearStatusButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  clearStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  statusMessage: {
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  statusSuccess: {
    backgroundColor: '#e8f5e8',
    borderLeftColor: '#2e7d32',
  },
  statusError: {
    backgroundColor: '#ffeaea',
    borderLeftColor: '#d32f2f',
  },
  statusWarning: {
    backgroundColor: '#fff3cd',
    borderLeftColor: '#f57c00',
  },
  statusInfo: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#1976d2',
  },
  statusMessageText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  statusTimestamp: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  tabBar: {
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    paddingTop: 40,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#007AFF',
  },
  tabIndicator: {
    backgroundColor: '#007AFF',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
})