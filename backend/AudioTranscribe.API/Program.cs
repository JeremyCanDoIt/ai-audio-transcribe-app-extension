// AudioTranscribe.API/Program.cs
using AudioTranscribe.Infrastructure.Services;
using AudioTranscribe.Infrastructure.Configuration;

var builder = WebApplication.CreateBuilder(args);

// DEBUG: Check what environment and configuration we're using
Console.WriteLine($"Environment: {builder.Environment.EnvironmentName}");
Console.WriteLine($"Content Root: {builder.Environment.ContentRootPath}");

// Add services to the container
builder.Services.AddControllers();

// Add CORS for Chrome extension
builder.Services.AddCors(options =>
{
    options.AddPolicy("ChromeExtension", policy =>
    {
        policy.WithOrigins("chrome-extension://*")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// DEBUG: Check what's in configuration before binding
var openAiSection = builder.Configuration.GetSection("OpenAI");
Console.WriteLine($"DEBUG - OpenAI section exists: {openAiSection.Exists()}");
Console.WriteLine($"DEBUG - ApiKey from config: {openAiSection["ApiKey"]}");
Console.WriteLine($"DEBUG - BaseUrl from config: {openAiSection["BaseUrl"]}");

// Create and validate OpenAI settings immediately
var openAiSettings = new OpenAISettings();
builder.Configuration.GetSection("OpenAI").Bind(openAiSettings);

Console.WriteLine($"DEBUG - After binding - ApiKey loaded: {(!string.IsNullOrEmpty(openAiSettings.ApiKey) ? "YES" : "NO")}");
Console.WriteLine($"DEBUG - After binding - BaseUrl: {openAiSettings.BaseUrl}");
Console.WriteLine($"DEBUG - After binding - Model: {openAiSettings.Model}");

// Validate immediately
if (string.IsNullOrEmpty(openAiSettings.ApiKey))
{
    throw new InvalidOperationException("OpenAI API key is required. Add it to appsettings.Development.json");
}

if (!openAiSettings.IsValid())
{
    throw new InvalidOperationException("OpenAI configuration is invalid");
}

Console.WriteLine("DEBUG - OpenAI configuration is valid!");

// Add OpenAI service
builder.Services.AddHttpClient<OpenAIService>();
builder.Services.AddScoped<OpenAIService>();

// Register the validated settings
builder.Services.Configure<OpenAISettings>(builder.Configuration.GetSection("OpenAI"));

// Add Swagger for testing
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// FORCE CREATE THE OPENAI SERVICE TO TEST IT
using (var scope = app.Services.CreateScope())
{
    Console.WriteLine("DEBUG - Testing OpenAI service creation...");
    var openAiService = scope.ServiceProvider.GetRequiredService<OpenAIService>();
    Console.WriteLine("DEBUG - OpenAI service created successfully!");
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Enable CORS
app.UseCors("ChromeExtension");

app.UseAuthorization();

app.MapControllers();

app.Run();