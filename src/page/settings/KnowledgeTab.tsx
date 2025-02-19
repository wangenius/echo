import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { KnowledgeStore, type Knowledge as KnowledgeType, type SearchResult } from "@/services/knowledge/KnowledgeStore";
import { cmd } from "@/utils/shell";
import { useState } from "react";
import { TbBrain, TbEye, TbFile, TbKey, TbSearch, TbSettings, TbTrash, TbUpload } from "react-icons/tb";




interface SearchOptions {
    threshold: number;
    limit: number;
}

export function KnowledgeTab() {
    const documents = KnowledgeStore.use((state) => state.items);
    const apiKey = KnowledgeStore.use((state) => state.apiKey);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchOptions, setSearchOptions] = useState<SearchOptions>({
        threshold: 0.7,
        limit: 10
    });
    const [showSearchOptions, setShowSearchOptions] = useState(false);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [previewDocument, setPreviewDocument] = useState<KnowledgeType | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<{ path: string; content: string }[]>([]);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [knowledgeName, setKnowledgeName] = useState("");
    const [category, setCategory] = useState("");
    const [tags, setTags] = useState("");
    const [tempApiKey, setTempApiKey] = useState(apiKey);

    const handleSaveApiKey = () => {
        KnowledgeStore.setApiKey(tempApiKey);
        setShowApiKeyDialog(false);
    };


    const handleUpload = async () => {
        if (!apiKey) {
            setShowApiKeyDialog(true);
            return;
        }

        try {
            const filePaths = await cmd.invoke<string[]>("open_files_path", {
                title: "选择文档",
                filters: {
                    "文本文件": ["txt", "md", "markdown"]
                }
            });

            if (filePaths && filePaths.length > 0) {
                const newFiles = await Promise.all(
                    filePaths.map(async (path) => {
                        const content = await cmd.invoke<string>("read_file_text", { path });
                        return { path, content };
                    })
                );
                setSelectedFiles(prev => [...prev, ...newFiles]);
                setShowUploadDialog(true);
            }
        } catch (error) {
            console.error("选择文件失败", error);
        }
    };

    const handleConfirmUpload = async () => {
        try {
            setLoading(true);
            await KnowledgeStore.addKnowledge(selectedFiles, {
                name: knowledgeName || undefined,
                category: category || undefined,
                tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : undefined
            });
            setSelectedFiles([]);
            setKnowledgeName('');
            setCategory('');
            setTags('');
            setShowUploadDialog(false);
        } catch (error) {
            console.error("文件上传失败", error);
        } finally {
            setLoading(false);
        }
    };

    const removeSelectedFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDelete = async (id: string) => {
        try {
            KnowledgeStore.deleteKnowledge(id);
        } catch (error) {
            console.error("删除失败", error);
        }
    };

    const handleSemanticSearch = async () => {
        if (!searchQuery.trim()) return;
        if (!apiKey) {
            setShowApiKeyDialog(true);
            return;
        }

        setSearchLoading(true);
        try {
            const results = await KnowledgeStore.searchKnowledge(searchQuery, searchOptions);
            setSearchResults(results);
        } catch (error) {
            console.error("搜索失败", error);
        } finally {
            setSearchLoading(false);
        }
    };

    const handlePreview = (doc: KnowledgeType) => {
        setPreviewDocument(doc);
        setShowPreviewDialog(true);
    };

    const filteredDocuments = documents.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.files.some(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-4 max-w-5xl mx-auto">
            {!apiKey && (
                <Alert variant="destructive">
                    <TbKey className="h-4 w-4" />
                    <AlertTitle>需要配置阿里云 API Key</AlertTitle>
                    <AlertDescription>
                        请先配置阿里云 API Key 以启用知识库功能
                        <Button
                            variant="outline"
                            size="sm"
                            className="ml-2"
                            onClick={() => setShowApiKeyDialog(true)}
                        >
                            立即配置
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex items-center gap-4 mb-4">
                <Button variant="outline" onClick={handleUpload} disabled={loading}>
                    <TbUpload className="w-4 h-4 mr-2" />
                    上传文档
                </Button>
                <Button variant="outline" onClick={() => setShowApiKeyDialog(true)}>
                    <TbKey className="w-4 h-4 mr-2" />
                    配置 API Key
                </Button>
                <Button variant="outline" onClick={() => setShowSearchOptions(!showSearchOptions)}>
                    <TbSettings className="w-4 h-4 mr-2" />
                    搜索设置
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>知识库搜索</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <TbSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-8"
                                placeholder="输入关键词进行语义搜索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch()}
                            />
                        </div>
                        <Button onClick={handleSemanticSearch} disabled={!searchQuery.trim() || searchLoading}>
                            <TbBrain className="w-4 h-4 mr-2" />
                            搜索
                        </Button>
                    </div>

                    {showSearchOptions && (
                        <Card>
                            <CardContent className="grid grid-cols-2 gap-4 pt-4">
                                <div className="space-y-2">
                                    <Label>相似度阈值</Label>
                                    <div className="flex items-center gap-4">
                                        <Slider
                                            value={[searchOptions.threshold]}
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            onValueChange={([value]) => setSearchOptions({
                                                ...searchOptions,
                                                threshold: value
                                            })}
                                        />
                                        <span className="text-sm w-12 text-right">
                                            {(searchOptions.threshold * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>结果数量</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={searchOptions.limit}
                                        onChange={(e) => setSearchOptions({
                                            ...searchOptions,
                                            limit: parseInt(e.target.value)
                                        })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
            {<Card>
                <CardHeader>
                    <CardTitle>知识库文档</CardTitle>
                    <CardDescription>
                        共有 {documents?.length} 个知识库，{documents?.reduce((acc, doc) => acc + doc.files.reduce((sum, file) => sum + file.chunks.length, 0), 0)} 个知识块
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                            {filteredDocuments.map((doc) => (
                                <Card key={doc.id} className="p-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-medium">{doc.name}</h3>
                                                <div className="text-sm text-muted-foreground">
                                                    版本: {doc.version} · {doc.files.length} 个文件 ·
                                                    {doc.files.reduce((sum, file) => sum + file.chunks.length, 0)} 个知识块 ·
                                                    {new Date(doc.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handlePreview(doc)}
                                                >
                                                    <TbEye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(doc.id)}
                                                >
                                                    <TbTrash className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        {doc.category && (
                                            <Badge variant="secondary">
                                                {doc.category}
                                            </Badge>
                                        )}
                                        <div className="flex flex-wrap gap-1">
                                            {doc.tags.map((tag, index) => (
                                                <Badge key={index} variant="outline">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="space-y-2 mt-2">
                                            {doc.files.map((file, index) => (
                                                <Card key={index} className="p-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <TbFile className="w-4 h-4" />
                                                            <div>
                                                                <div className="font-medium">{file.name}</div>
                                                                <div className="text-sm text-muted-foreground">
                                                                    {file.chunks.length} 个知识块 · {file.file_type} ·
                                                                    {new Date(file.created_at).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                            {filteredDocuments.length === 0 && (
                                <div className="text-center py-4 text-muted-foreground">
                                    暂无文档
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>}

            {searchResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>搜索结果</CardTitle>
                        <CardDescription>
                            找到 {searchResults.length} 条相关内容
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-2">
                                {searchResults.map((result, index) => (
                                    <Card key={index}>
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <Badge variant="outline">
                                                    {result.document_name}
                                                </Badge>
                                                <Badge>
                                                    相似度: {(result.similarity * 100).toFixed(1)}%
                                                </Badge>
                                            </div>
                                            <p className="text-sm">
                                                {result.content}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>配置阿里云 API Key</DialogTitle>
                        <DialogDescription>
                            请输入您的阿里云 API Key，用于文本向量化服务
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="api-key">API Key</Label>
                            <Input
                                id="api-key"
                                value={tempApiKey}
                                onChange={(e) => setTempApiKey(e.target.value)}
                                placeholder="sk-..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
                            取消
                        </Button>
                        <Button onClick={handleSaveApiKey} disabled={!tempApiKey}>
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{previewDocument?.name}</DialogTitle>
                        <DialogDescription>
                            {previewDocument && (
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <Badge>{previewDocument.version}</Badge>
                                    {previewDocument.category && (
                                        <Badge variant="secondary">{previewDocument.category}</Badge>
                                    )}
                                    {previewDocument.tags.map((tag, index) => (
                                        <Badge key={index} variant="outline">{tag}</Badge>
                                    ))}
                                    <span>创建于 {new Date(previewDocument.created_at).toLocaleString()}</span>
                                    <span>·</span>
                                    <span>更新于 {new Date(previewDocument.updated_at).toLocaleString()}</span>
                                </div>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] mt-4">
                        {previewDocument && (
                            <div className="space-y-6">
                                {previewDocument.files.map((file, fileIndex) => (
                                    <div key={fileIndex} className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <TbFile className="w-4 h-4" />
                                            <h3 className="font-medium">{file.name}</h3>
                                            <Badge variant="outline">{file.file_type}</Badge>
                                        </div>
                                        <div className="prose dark:prose-invert max-w-none">
                                            <pre className="whitespace-pre-wrap font-mono text-sm">
                                                {file.content}
                                            </pre>
                                        </div>
                                        <div className="mt-4">
                                            <h4 className="text-sm font-medium mb-2">知识块列表</h4>
                                            <div className="space-y-2">
                                                {file.chunks.map((chunk, index) => (
                                                    <Card key={index}>
                                                        <CardContent className="p-3">
                                                            <div className="flex justify-between items-start gap-4">
                                                                <p className="text-sm flex-1">{chunk.content}</p>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {chunk.metadata.paragraph_number && `#${chunk.metadata.paragraph_number}`}
                                                                    {chunk.metadata.source_page && ` · 页 ${chunk.metadata.source_page}`}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                            关闭
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>上传文档</DialogTitle>
                        <DialogDescription>
                            已选择 {selectedFiles.length} 个文件，您可以继续添加更多文件或开始上传
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="knowledge-name">知识库名称</Label>
                            <Input
                                id="knowledge-name"
                                placeholder="请输入知识库名称（可选）"
                                value={knowledgeName}
                                onChange={(e) => setKnowledgeName(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="category">分类</Label>
                            <Input
                                id="category"
                                placeholder="请输入分类（可选）"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="tags">标签</Label>
                            <Input
                                id="tags"
                                placeholder="请输入标签，用逗号分隔（可选）"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-[200px] mt-4">
                        <div className="space-y-2">
                            {selectedFiles.map((file, index) => (
                                <Card key={index}>
                                    <CardContent className="p-3 flex justify-between items-center">
                                        <span className="text-sm truncate flex-1">{file.path}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeSelectedFile(index)}
                                        >
                                            <TbTrash className="w-4 h-4" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="flex justify-between">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleUpload}>
                                <TbUpload className="w-4 h-4 mr-2" />
                                继续添加
                            </Button>
                            <Button variant="outline" onClick={() => {
                                setSelectedFiles([]);
                                setKnowledgeName('');
                                setCategory('');
                                setTags('');
                                setShowUploadDialog(false);
                            }}>
                                清空列表
                            </Button>
                        </div>
                        <Button onClick={handleConfirmUpload} disabled={selectedFiles.length === 0 || loading}>
                            {loading ? "上传中..." : "确认上传"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
