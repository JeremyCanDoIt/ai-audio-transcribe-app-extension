// AudioTranscribe.API/Program.cs
using AudioTranscribe.Infrastructure.Services;
using AudioTranscribe.Infrastructure.Configuration;

var builder = WebApplication.CreateBuilder(args);

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

// Add OpenAI service
builder.Services.AddHttpClient<OpenAIService>();
builder.Services.AddScoped<OpenAIService>();

// Add configuration with validation
builder.Services.Configure<OpenAISettings>(options =>
{
    builder.Configuration.GetSection("OpenAI").Bind(options);
    
    // Validate API key is present
    if (string.IsNullOrEmpty(options.ApiKey))
    {
        throw new InvalidOperationException(
            "OpenAI API key is required. Set it using: dotnet user-secrets set \"OpenAI:ApiKey\" \"your-key\"");
    }
    
    if (!options.IsValid())
    {
        throw new InvalidOperationException("OpenAI configuration is invalid");
    }
});

// Add Swagger for testing
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

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