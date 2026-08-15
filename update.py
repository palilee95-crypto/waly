import re

with open('app/(merchant)/_components/TemplateStudio.tsx', 'r') as f:
    content = f.read()

# Restore expandedTemplateId state
content = re.sub(r'  const \[isRefreshing, setIsRefreshing\] = useState\(false\);\n', r'  const [isRefreshing, setIsRefreshing] = useState(false);\n  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);\n', content)

# Remove insertVariable, compileTemplatePayload, handleCreateTemplate safely using awk pattern equivalent
content = re.sub(r'  const insertVariable = \(variableKey: string\) => \{.*?  };\n\n', '', content, flags=re.DOTALL)
content = re.sub(r'  // Convert friendly \{Customer Name\} placeholders into Meta \{\{1\}\}, \{\{2\}\} & samples\n  const compileTemplatePayload = \(\) => \{.*?\n  };\n\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleCreateTemplate = async \(\) => \{.*?\n  };\n\n', '', content, flags=re.DOTALL)

# Remove Modal JSX block safely
content = re.sub(r'      \{\/\* ── CREATE / EDIT TEMPLATE MODAL ── \*\/\}\n      <Modal.*?      </Modal>\n', '', content, flags=re.DOTALL)

with open('app/(merchant)/_components/TemplateStudio.tsx', 'w') as f:
    f.write(content)
