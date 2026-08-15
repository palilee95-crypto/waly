import re

with open('app/(merchant)/_components/TemplateStudio.tsx', 'r') as f:
    content = f.read()

# 1. Remove form states and modalVisible
content = re.sub(r'  const \[modalVisible, setModalVisible\] = useState\(false\);\n', '', content)
content = re.sub(r'  // Form State\n  const \[formName.*?\n  const \[formError, setFormError\] = useState\(\'\'\);\n', '', content, flags=re.DOTALL)

# 2. Update handleOpenCreateModal
new_handle = """  const handleOpenCreateModal = (preset?: typeof STARTER_PRESETS[0]) => {
    if (preset) {
      router.push({
        pathname: '/(merchant)/create-template',
        params: {
          presetName: preset.name,
          presetCategory: preset.category,
          presetHeader: preset.header,
          presetBody: preset.body,
          presetFooter: preset.footer,
        },
      });
    } else {
      router.push('/(merchant)/create-template');
    }
  };"""
content = re.sub(r'  const handleOpenCreateModal = \(preset\?: typeof STARTER_PRESETS\[0\]\) => \{.*?\n  };\n', new_handle + '\n', content, flags=re.DOTALL)

# 3. Remove insertVariable, compileTemplatePayload, handleCreateTemplate
content = re.sub(r'  const insertVariable = \(variableKey: string\) => \{.*?  };\n', '', content, flags=re.DOTALL)
content = re.sub(r'  // Convert friendly \{Customer Name\}.*?  };\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleCreateTemplate = async \(\) => \{.*?  };\n', '', content, flags=re.DOTALL)

# 4. Remove Modal JSX block
content = re.sub(r'      \{\/\* ── CREATE \/ EDIT TEMPLATE MODAL ── \*\/}.*?      </Modal>', '', content, flags=re.DOTALL)

# 5. Simplify banner
old_banner = """      {/* ── NOT CONNECTED WARNING BANNER ── */}
      {!isConnected && (
        <View style={styles.notConnectedBanner}>
          <View style={styles.notConnectedLeft}>
            <View style={styles.notConnectedIconBox}>
              <Ionicons name="warning" size={16} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notConnectedTitle}>WhatsApp Business Not Connected</Text>
              <Text style={styles.notConnectedDesc}>
                Connect your WhatsApp Business number in Settings to submit templates for instant 1–2 min Meta approval.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.connectMetaBtn}
            onPress={() => router.push('/(merchant)/profile')}
            activeOpacity={0.85}
          >
            <Ionicons name="logo-whatsapp" size={14} color="#050505" />
            <Text style={styles.connectMetaBtnText}>Connect Number</Text>
          </TouchableOpacity>
        </View>
      )}"""
new_banner = """      {/* ── NOT CONNECTED WARNING BANNER ── */}
      {!isConnected && (
        <View style={styles.notConnectedBanner}>
          <Ionicons name="warning" size={20} color="#F59E0B" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.notConnectedTitle}>WhatsApp Not Connected</Text>
            <Text style={styles.notConnectedDesc}>
              Connect your number to submit templates for approval.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.connectMetaBtn}
            onPress={() => router.push('/(merchant)/profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.connectMetaBtnText}>Connect</Text>
          </TouchableOpacity>
        </View>
      )}"""
content = content.replace(old_banner, new_banner)

# Update banner styles
old_banner_styles = """  notConnectedBanner: {
    backgroundColor: '#050505',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  notConnectedLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notConnectedIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notConnectedTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  notConnectedDesc: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 18,
  },
  connectMetaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFC700',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  connectMetaBtnText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },"""

new_banner_styles = """  notConnectedBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notConnectedTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
    marginBottom: 2,
  },
  notConnectedDesc: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B45309',
    lineHeight: 16,
  },
  connectMetaBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  connectMetaBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },"""
content = content.replace(old_banner_styles, new_banner_styles)

# 6. Apply text node crash fix
content = re.sub(r'\{tpl\.rejectedReason && \(\n(.*?)\n\s*\)\}', r'{tpl.rejectedReason ? (\n\1\n                    ) : null}', content, flags=re.DOTALL)
content = re.sub(r'\{tpl\.headerText && \(\n(.*?)\n\s*\)\}', r'{tpl.headerText ? (\n\1\n                          ) : null}', content, flags=re.DOTALL)
content = re.sub(r'\{tpl\.footerText && \(\n(.*?)\n\s*\)\}', r'{tpl.footerText ? (\n\1\n                          ) : null}', content, flags=re.DOTALL)

with open('app/(merchant)/_components/TemplateStudio.tsx', 'w') as f:
    f.write(content)

