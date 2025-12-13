/**
 * AI Model Manager - LangChain Integration for qerrors
 * 
 * This module provides a unified interface for different AI models using LangChain,
 * allowing easy switching between OpenAI, Anthropic, and other providers while
 * maintaining consistent error analysis functionality.
 * 
 * Design rationale:
 * - Uses LangChain for standardized model interaction across providers
 * - Maintains backward compatibility with existing OpenAI integration
 * - Provides factory pattern for easy model switching via environment variables
 * - Includes graceful fallback when models are unavailable
 * - Supports both streaming and non-streaming responses
 */

const{ChatOpenAI}=require('@langchain/openai'),{ChatGoogleGenerativeAI}=require('@langchain/google-genai'),{HumanMessage}=require('@langchain/core/messages'),{verboseLog}=require('./utils');

const MODEL_PROVIDERS={OPENAI:'openai',GOOGLE:'google'};

const MODEL_CONFIGS={[MODEL_PROVIDERS.OPENAI]:{models:{'gpt-4o':{maxTokens:4096,temperature:0.1,topP:1},'gpt-4o-mini':{maxTokens:4096,temperature:0.1,topP:1},'gpt-4':{maxTokens:4096,temperature:0.1,topP:1},'gpt-3.5-turbo':{maxTokens:4096,temperature:0.1,topP:1}},defaultModel:'gpt-4o',requiredEnvVars:['OPENAI_API_KEY']},[MODEL_PROVIDERS.GOOGLE]:{models:{'gemini-2.5-flash-lite':{maxTokens:8192,temperature:0.1,topP:1},'gemini-2.0-flash-exp':{maxTokens:8192,temperature:0.1,topP:1},'gemini-pro':{maxTokens:8192,temperature:0.1,topP:1},'gemini-1.5-pro':{maxTokens:8192,temperature:0.1,topP:1},'gemini-1.5-flash':{maxTokens:8192,temperature:0.1,topP:1}},defaultModel:'gemini-2.5-flash-lite',requiredEnvVars:['GEMINI_API_KEY']}};

const createLangChainModel=(provider=MODEL_PROVIDERS.GOOGLE,modelName=null)=>{const providerConfig=MODEL_CONFIGS[provider];if(!providerConfig)throw new Error(`Unsupported AI provider: ${provider}`);const missingVars=providerConfig.requiredEnvVars.filter(envVar=>!process.env[envVar]);if(missingVars.length>0)throw new Error(`Missing required environment variables for ${provider}: ${missingVars.join(', ')}`);const selectedModel=modelName||providerConfig.defaultModel,modelConfig=providerConfig.models[selectedModel];if(!modelConfig)throw new Error(`Unsupported model ${selectedModel} for provider ${provider}`);switch(provider){case MODEL_PROVIDERS.OPENAI:return new ChatOpenAI({modelName:selectedModel,temperature:modelConfig.temperature,maxTokens:parseInt(process.env.QERRORS_MAX_TOKENS)||modelConfig.maxTokens,topP:modelConfig.topP,openAIApiKey:process.env.OPENAI_API_KEY,verbose:process.env.QERRORS_VERBOSE!=='false'});case MODEL_PROVIDERS.GOOGLE:return new ChatGoogleGenerativeAI({modelName:selectedModel,temperature:modelConfig.temperature,maxOutputTokens:parseInt(process.env.QERRORS_MAX_TOKENS)||modelConfig.maxTokens,topP:modelConfig.topP,apiKey:process.env.GEMINI_API_KEY,verbose:process.env.QERRORS_VERBOSE!=='false'});default:throw new Error(`Model creation not implemented for provider: ${provider}`);}};

class AIModelManager{constructor(){this.currentProvider=process.env.QERRORS_AI_PROVIDER||MODEL_PROVIDERS.GOOGLE;this.currentModel=process.env.QERRORS_AI_MODEL||null;this.modelInstance=null;this.initializeModel();}
initializeModel(){try{this.modelInstance=createLangChainModel(this.currentProvider,this.currentModel);verboseLog(`AI Model Manager initialized with provider: ${this.currentProvider}, model: ${this.currentModel||'default'}`);}catch(error){verboseLog(`Failed to initialize AI model: ${error.message}`);this.modelInstance=null;}}
switchModel(provider,modelName=null){try{this.currentProvider=provider;this.currentModel=modelName;this.modelInstance=createLangChainModel(provider,modelName);verboseLog(`Switched to AI provider: ${provider}, model: ${modelName||'default'}`);return true;}catch(error){verboseLog(`Failed to switch AI model: ${error.message}`);return false;}}
getCurrentModelInfo(){return{provider:this.currentProvider,model:this.currentModel||MODEL_CONFIGS[this.currentProvider]?.defaultModel,available:this.modelInstance!==null};}
getAvailableModels(provider=this.currentProvider){const providerConfig=MODEL_CONFIGS[provider];return providerConfig?Object.keys(providerConfig.models):[];}
async analyzeError(errorPrompt){if(!this.modelInstance){verboseLog('No AI model available for error analysis');return null;}
try{verboseLog(`Analyzing error with ${this.currentProvider} model`);const analysisModel=this.createAnalysisModel();const messages=[new HumanMessage(errorPrompt)];const response=await analysisModel.invoke(messages);let advice=response.content;
if(typeof advice==='string'){try{let cleanedAdvice=advice.trim();if(cleanedAdvice.startsWith('```json')&&cleanedAdvice.endsWith('```')){cleanedAdvice=cleanedAdvice.slice(7,-3).trim();}else if(cleanedAdvice.startsWith('```')&&cleanedAdvice.endsWith('```')){cleanedAdvice=cleanedAdvice.slice(3,-3).trim();}
advice=JSON.parse(cleanedAdvice);}catch{advice=null;}}
verboseLog(`AI analysis completed successfully`);return advice;}catch(error){verboseLog(`AI analysis failed: ${error.message}`);return null;}}
createAnalysisModel(){const providerConfig=MODEL_CONFIGS[this.currentProvider];const selectedModel=this.currentModel||providerConfig.defaultModel;const modelConfig=providerConfig.models[selectedModel];
switch(this.currentProvider){case MODEL_PROVIDERS.OPENAI:return new ChatOpenAI({modelName:selectedModel,temperature:1,maxTokens:parseInt(process.env.QERRORS_MAX_TOKENS)||modelConfig.maxTokens,topP:1,frequencyPenalty:0,presencePenalty:0,openAIApiKey:process.env.OPENAI_API_KEY,verbose:process.env.QERRORS_VERBOSE!=='false',modelKwargs:{response_format:{type:'json_object'}}});
case MODEL_PROVIDERS.GOOGLE:return new ChatGoogleGenerativeAI({modelName:selectedModel,temperature:1,maxOutputTokens:parseInt(process.env.QERRORS_MAX_TOKENS)||modelConfig.maxTokens,topP:1,apiKey:process.env.GEMINI_API_KEY,verbose:process.env.QERRORS_VERBOSE!=='false'});
default:throw new Error(`Analysis model creation not implemented for provider: ${this.currentProvider}`);}}
async healthCheck(){if(!this.modelInstance){return{healthy:false,error:'No model instance available'};}
try{const testMessage=new HumanMessage('Test connection - respond with "OK"');const response=await this.modelInstance.invoke([testMessage]);return{healthy:true,provider:this.currentProvider,model:this.currentModel,response:response.content};}catch(error){return{healthy:false,error:error.message,provider:this.currentProvider};}}}

let aiModelManager=null;const getAIModelManager=()=>{if(!aiModelManager)aiModelManager=new AIModelManager();return aiModelManager;};const resetAIModelManager=()=>{aiModelManager=null;};module.exports={AIModelManager,getAIModelManager,resetAIModelManager,MODEL_PROVIDERS,MODEL_CONFIGS,createLangChainModel};